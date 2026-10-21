// Publishes the prototype to Cloudflare Pages behind Cloudflare Access, so only the Appmilla team and the people
// listed in share.json can open the link (they sign in with a one-time code sent to their email).
//
//   node tools/share.ts                          publish the current commit; prints the link
//   node tools/share.ts --add a@x.com,b@y.com    let these people open it (then publishes)
//   node tools/share.ts --remove a@x.com         stop these people opening it (then publishes)
//   node tools/share.ts --status                 show the link and who can open it; publishes nothing
//   node tools/share.ts --unpublish              take it offline: deletes its Cloudflare project and access rule
//
// Cloudflare builds the prototype from GitHub: this script pushes the commit to the `shared` branch and asks
// Cloudflare to build it. The Cloudflare API token never needs to be visible here: in Claude Code on the web it is
// a network secret that is added to requests to api.cloudflare.com on the way out. Elsewhere, set
// CLOUDFLARE_API_TOKEN. Never publishes unless the address already asks for a sign-in, so a link is never public.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = 'share.json';
const SHARED_BRANCH = 'shared';
/** Email domains that can always open Appmilla prototypes. */
const TEAM_DOMAINS = ['appmilla.com'];
const API = 'https://api.cloudflare.com/client/v4';
const SETUP = 'See "One-time setup" in tools/SHARING.md.';

interface ShareConfig {
  /** Cloudflare Pages project name; also the start of the link. */
  project: string;
  /** Email addresses outside the team who may open the link, such as the client. */
  people: string[];
  /** The link, once published. */
  url?: string;
  /** The version last published. */
  lastShared?: { commit: string; date: string };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function git(...args: string[]) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** The GitHub owner and repository name, from the origin remote's last two path segments. */
function githubRepo() {
  const parts = git('remote', 'get-url', 'origin')
    .replace(/\.git$/, '')
    .split(/[/:]/)
    .filter(Boolean);
  if (parts.length < 2) fail('Couldn’t tell which GitHub repository this is from the origin remote.');
  return { owner: parts[parts.length - 2], repo: parts[parts.length - 1] };
}

/** A valid Pages project name from the repository's name: lowercase letters, digits and hyphens. */
function defaultProject() {
  const remote = git('remote', 'get-url', 'origin');
  const name = remote ? basename(remote).replace(/\.git$/, '') : basename(ROOT);
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 58) || 'prototype'
  );
}

function loadConfig(): ShareConfig {
  const file = join(ROOT, CONFIG_FILE);
  if (!existsSync(file)) return { project: defaultProject(), people: [] };
  return { people: [], ...(JSON.parse(readFileSync(file, 'utf8')) as Partial<ShareConfig>) } as ShareConfig;
}

function saveConfig(config: ShareConfig) {
  writeFileSync(join(ROOT, CONFIG_FILE), `${JSON.stringify(config, null, 2)}\n`);
}

function emails(value: string | undefined) {
  const list = (value ?? '')
    .split(/[\s,]+/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const bad = list.filter((email) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email));
  if (bad.length) fail(`These don't look like email addresses: ${bad.join(', ')}`);
  return list;
}

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : (process.argv[index + 1] ?? '');
}

interface ApiResult<T> {
  success: boolean;
  result: T;
  errors: { code: number; message: string }[];
}

/** Calls the Cloudflare API. The token header is only sent when CLOUDFLARE_API_TOKEN is set (outside the cloud). */
async function call<T>(method: string, path: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (process.env.CLOUDFLARE_API_TOKEN) headers.Authorization = `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`;
  if (body !== undefined && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });
  let data: ApiResult<T>;
  try {
    data = (await response.json()) as ApiResult<T>;
  } catch {
    data = {
      success: false,
      result: undefined as T,
      errors: [{ code: response.status, message: response.statusText }],
    };
  }
  const authCodes = [9106, 9109, 10000, 10001];
  if (response.status === 401 || data.errors?.some((error) => authCodes.includes(error.code))) {
    fail(`Cloudflare didn’t accept the API token, or none was sent. ${SETUP}`);
  }
  return { status: response.status, data };
}

async function callOk<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { status, data } = await call<T>(method, path, body);
  if (!data.success) {
    const why = data.errors.map((error) => `${error.message} (${error.code})`).join('; ');
    fail(`Cloudflare refused ${method} ${path} (HTTP ${status}): ${why}`);
  }
  return data.result;
}

let accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? '';

/** The account the token belongs to; set CLOUDFLARE_ACCOUNT_ID if the token can see more than one. */
async function account() {
  if (accountId) return accountId;
  const accounts = await callOk<{ id: string; name: string }[]>('GET', '/accounts');
  if (accounts.length === 0) {
    // Usual for a token scoped to one account: it works, but listing accounts needs Account Settings · Read.
    fail(
      'Cloudflare accepted the API token but won’t say which account it belongs to. Set CLOUDFLARE_ACCOUNT_ID to ' +
        'Appmilla’s account ID (on the account’s Overview page in the Cloudflare dashboard; it isn’t a secret), or ' +
        `give the token Account · Account Settings · Read. ${SETUP}`,
    );
  }
  if (accounts.length > 1) {
    fail(`The API token can see ${accounts.length} Cloudflare accounts; set CLOUDFLARE_ACCOUNT_ID to choose one.`);
  }
  accountId = accounts[0].id;
  return accountId;
}

async function accountApi<T>(method: string, path: string, body?: unknown) {
  return call<T>(method, `/accounts/${await account()}${path}`, body);
}

async function accountApiOk<T>(method: string, path: string, body?: unknown) {
  return callOk<T>(method, `/accounts/${await account()}${path}`, body);
}

interface PagesProject {
  name: string;
  subdomain: string;
}

async function findProject(name: string): Promise<PagesProject | null> {
  const { status, data } = await accountApi<PagesProject>('GET', `/pages/projects/${name}`);
  if (data.success) return data.result;
  if (status === 404) return null;
  return fail(
    `Couldn't look up the Cloudflare Pages project "${name}": ${data.errors.map((e) => e.message).join('; ')}`,
  );
}

/** A Pages project that Cloudflare builds from this repository's `shared` branch, and only that branch. */
async function createProject(name: string): Promise<PagesProject> {
  const { owner, repo } = githubRepo();
  const { status, data } = await accountApi<PagesProject>('POST', '/pages/projects', {
    name,
    production_branch: SHARED_BRANCH,
    source: {
      type: 'github',
      config: {
        owner,
        repo_name: repo,
        production_branch: SHARED_BRANCH,
        pr_comments_enabled: false,
        deployments_enabled: true,
        production_deployments_enabled: true,
        preview_deployment_setting: 'none',
      },
    },
    build_config: { build_command: 'npm run build', destination_dir: 'dist', root_dir: '' },
    deployment_configs: {
      production: { env_vars: { NODE_VERSION: { type: 'plain_text', value: '22' } } },
    },
  });
  if (data.success) return data.result;
  const why = data.errors.map((error) => `${error.message} (${error.code})`).join('; ');
  return fail(
    `Cloudflare couldn't create the project from ${owner}/${repo} (HTTP ${status}): ${why}\n` +
      `Cloudflare may not be connected to the ${owner} GitHub organisation yet. ${SETUP}`,
  );
}

interface AccessApp {
  id: string;
  name: string;
}

function accessName(project: string) {
  return `Prototype: ${project}`;
}

async function findAccessApp(project: string): Promise<AccessApp | null> {
  for (let page = 1; ; page++) {
    const apps = await accountApiOk<AccessApp[]>('GET', `/access/apps?per_page=100&page=${page}`);
    const found = apps.find((app) => app.name === accessName(project));
    if (found) return found;
    if (apps.length < 100) return null;
  }
}

/** Creates or updates the access rule: the team's email domains and the listed people, on every address. */
async function saveAccessApp(project: string, host: string, people: string[]) {
  const body = {
    name: accessName(project),
    type: 'self_hosted',
    domain: host,
    destinations: [
      { type: 'public', uri: host },
      { type: 'public', uri: `*.${host}` },
    ],
    session_duration: '720h',
    app_launcher_visible: false,
    policies: [
      {
        name: 'Appmilla team and invited people',
        decision: 'allow',
        include: [
          ...TEAM_DOMAINS.map((domain) => ({ email_domain: { domain } })),
          ...people.map((email) => ({ email: { email } })),
        ],
      },
    ],
  };
  const existing = await findAccessApp(project);
  if (existing) await accountApiOk('PUT', `/access/apps/${existing.id}`, body);
  else await accountApiOk('POST', '/access/apps', body);
}

/**
 * What visitors get at an address: sent to the Cloudflare Access sign-in ('asks'), shown a page without signing in
 * ('open'), or nothing yet ('unreachable'), as with a brand-new project whose address isn't online.
 */
async function signInCheck(url: string): Promise<'asks' | 'open' | 'unreachable'> {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    const location = response.headers.get('location') ?? '';
    if (response.status >= 300 && response.status < 400 && location.includes('cloudflareaccess.com')) return 'asks';
    return response.status >= 500 ? 'unreachable' : 'open';
  } catch {
    return 'unreachable';
  }
}

/**
 * Waits until the address and a subdomain of it both ask for a sign-in. A new project's address can take several
 * minutes to come online, so this waits up to six minutes. Returns 'open' if a page was ever shown without one.
 */
async function waitForSignIn(host: string): Promise<'asks' | 'open' | 'unreachable'> {
  let said = false;
  for (let attempt = 0; attempt < 72; attempt++) {
    const results = await Promise.all([signInCheck(`https://${host}/`), signInCheck(`https://check.${host}/`)]);
    if (results.every((result) => result === 'asks')) return 'asks';
    if (results.includes('open') && attempt >= 12) return 'open';
    if (!said && results.includes('unreachable')) {
      console.log(`Waiting for https://${host} to come online (a new prototype's address can take a few minutes)…`);
      said = true;
    }
    await sleep(5000);
  }
  const last = await Promise.all([signInCheck(`https://${host}/`), signInCheck(`https://check.${host}/`)]);
  return last.includes('open') ? 'open' : 'unreachable';
}

function sleep(ms: number) {
  return new Promise((done) => setTimeout(done, ms));
}

interface Deployment {
  id: string;
  latest_stage: { name: string; status: string };
  deployment_trigger?: { metadata?: { commit_hash?: string; branch?: string } };
}

async function deploymentFor(project: string, commit: string) {
  const list = await accountApiOk<Deployment[]>('GET', `/pages/projects/${project}/deployments?env=production`);
  return (
    list.find((deployment) => {
      const hash = deployment.deployment_trigger?.metadata?.commit_hash;
      return Boolean(hash) && (hash!.startsWith(commit) || commit.startsWith(hash!));
    }) ?? null
  );
}

/** Waits for Cloudflare to build and publish the commit. Starts the build itself if the push didn't. */
async function waitForDeployment(project: string, commit: string) {
  let deployment: Deployment | null = null;
  for (let attempt = 0; attempt < 6 && !deployment; attempt++) {
    await sleep(5000);
    deployment = await deploymentFor(project, commit);
  }
  if (!deployment) {
    const form = new FormData();
    form.set('branch', SHARED_BRANCH);
    deployment = await accountApiOk<Deployment>('POST', `/pages/projects/${project}/deployments`, form);
  }
  console.log('Cloudflare is building the prototype…');
  for (let attempt = 0; attempt < 90; attempt++) {
    const current = await accountApiOk<Deployment>('GET', `/pages/projects/${project}/deployments/${deployment.id}`);
    const { name, status } = current.latest_stage;
    if (name === 'deploy' && status === 'success') return;
    if (status === 'failure' || status === 'canceled') {
      const logs = await accountApi<{ data: { line: string }[] }>(
        'GET',
        `/pages/projects/${project}/deployments/${deployment.id}/history/logs`,
      );
      const tail = (logs.data.result?.data ?? []).slice(-30).map((entry) => entry.line);
      fail([`Cloudflare's build stopped at "${name}" (${status}). The end of its log:`, ...tail].join('\n'));
    }
    await sleep(10000);
  }
  fail('Cloudflare is still building after 15 minutes; check the project in the Cloudflare dashboard.');
}

function whoCanOpen(config: ShareConfig) {
  const team = TEAM_DOMAINS.map((domain) => `anyone with an @${domain} email`).join(', ');
  return config.people.length ? `${team}, and ${config.people.join(', ')}` : `${team} (no one else yet)`;
}

async function main() {
  const config = loadConfig();
  const add = emails(option('--add'));
  const remove = emails(option('--remove'));
  if (add.length || remove.length) {
    config.people = [...new Set([...config.people, ...add])].filter((email) => !remove.includes(email)).sort();
    saveConfig(config);
  }

  if (process.argv.includes('--status')) {
    console.log(config.url ? `Link: ${config.url}` : 'Not published yet.');
    if (config.lastShared) {
      console.log(`Last published: ${config.lastShared.date}, commit ${config.lastShared.commit}.`);
    }
    console.log(`Who can open it: ${whoCanOpen(config)}.`);
    return;
  }

  if (process.argv.includes('--unpublish')) {
    const app = await findAccessApp(config.project);
    if (await findProject(config.project)) await accountApiOk('DELETE', `/pages/projects/${config.project}`);
    if (app) await accountApiOk('DELETE', `/access/apps/${app.id}`);
    delete config.url;
    delete config.lastShared;
    saveConfig(config);
    console.log(`Taken offline: the Cloudflare project "${config.project}" and its access rule are deleted.`);
    return;
  }

  const uncommitted = git('status', '--porcelain')
    .split('\n')
    .filter((line) => line && !line.endsWith(CONFIG_FILE));
  if (uncommitted.length) fail('Commit the changes first: only committed work can be shared.');

  const project = (await findProject(config.project)) ?? (await createProject(config.project));
  const host = project.subdomain;

  await saveAccessApp(config.project, host, config.people);
  const before = await waitForSignIn(host);
  if (before === 'open') {
    fail(
      `Not publishing: https://${host} doesn't ask visitors to sign in yet, so the prototype would be public.\n` +
        `Check that Cloudflare Zero Trust is set up on the account. ${SETUP}`,
    );
  }
  if (before === 'unreachable') {
    fail(
      `Not publishing yet: https://${host} isn't reachable from here, so it can't be checked for a sign-in.\n` +
        'A new prototype’s address can take a few more minutes to come online: run the share again shortly. If it ' +
        `still fails, check this environment's network access allows *.pages.dev. ${SETUP}`,
    );
  }

  const commit = git('rev-parse', 'HEAD');
  const push = spawnSync('git', ['push', '--force', 'origin', `HEAD:refs/heads/${SHARED_BRANCH}`], {
    cwd: ROOT,
    stdio: 'inherit',
  });
  if (push.status !== 0) fail(`Couldn't push this version to the ${SHARED_BRANCH} branch.`);
  await waitForDeployment(config.project, commit);

  const after = await waitForSignIn(host);
  if (after === 'open') {
    fail(`Published, but https://${host} no longer asks visitors to sign in. Take it offline with --unpublish.`);
  }
  if (after === 'unreachable') {
    fail(`Published, but https://${host} couldn't be reached to check its sign-in. Run the share again to check.`);
  }

  config.url = `https://${host}`;
  config.lastShared = { commit: commit.slice(0, 7), date: new Date().toISOString() };
  saveConfig(config);
  console.log(`Published: ${config.url}`);
  console.log(`Who can open it: ${whoCanOpen(config)}. They sign in with a code sent to their email.`);
}

// Node's fetch ignores HTTPS_PROXY unless asked; behind a proxy (as in Claude Code on the web), run again with it on.
if ((process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY) {
  const again = spawnSync(
    process.execPath,
    [...process.execArgv, '--disable-warning=UNDICI-EHPA', ...process.argv.slice(1)],
    { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } },
  );
  process.exit(again.status ?? 1);
} else {
  await main().catch((error: unknown) => {
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : '';
    fail(`Couldn't reach Cloudflare: ${error instanceof Error ? error.message : String(error)}${cause}`);
  });
}
