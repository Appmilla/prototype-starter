// Writes prototype-map.json and PROTOTYPE-MAP.md from the route table and the pages it points to.
//
//   node tools/screen-map.ts            write the map; quiet unless the route table can't be read
//   node tools/screen-map.ts --check    also check the prototype is ready for sign-off, in plain words
//   node tools/screen-map.ts --changes  also write CHANGES-SINCE-SIGN-OFF.md against the last sign-off/* tag
//
// The map is plain JSON with nothing React-specific in it, so tools outside the prototype can read it.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROUTES_FILE = 'src/routes.ts';
const COMPONENTS_DIR = 'src/components/';
const ALL_STATES = ['empty', 'loading', 'error', 'denied'];

export interface MapScreen {
  id: string;
  path: string;
  title: string;
  designScreen: string | null;
  linksTo: string[];
  states: string[];
  roles: string[];
  files: string[];
}

export interface PrototypeMap {
  starterVersion: string;
  screens: MapScreen[];
}

interface HandoffMap {
  screens: { id: string; title?: string; linksTo: string[] }[];
}

/** What was found while reading a page, for the sign-off check. */
interface PageFindings {
  id: string;
  page: string;
  unknownLinks: string[];
  drawsStates: boolean;
  dataLiterals: number;
  outsideImports: string[];
}

const problems: string[] = [];

function read(file: string) {
  return readFileSync(join(ROOT, file), 'utf8');
}

function parse(file: string) {
  return ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

/** Resolves a relative import to a project file such as src/pages/Home.tsx, or null for packages. */
function resolveImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = join(dirname(fromFile), specifier);
  const candidates = [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')];
  const found = candidates.find((candidate) => /\.tsx?$/.test(candidate) && existsSync(join(ROOT, candidate)));
  return found ? found.split('\\').join('/') : null;
}

/** Every import in a file: local name -> resolved project file (or the package name). */
function importsOf(file: string, source: ts.SourceFile) {
  const names = new Map<string, string>();
  const files: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    const target = resolveImport(file, specifier) ?? specifier;
    if (!statement.importClause?.isTypeOnly) files.push(target);
    const clause = statement.importClause;
    if (clause?.name) names.set(clause.name.text, target);
    if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) names.set(element.name.text, target);
    }
  }
  return { names, files };
}

function stringValue(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return stringValue(node.expression);
  return null;
}

function stringList(node: ts.Expression | undefined, field: string, id: string): string[] {
  if (!node) return [];
  if (ts.isIdentifier(node) && /^(ALL_STATES|PAGE_STATES)$/.test(node.text)) return [...ALL_STATES];
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return stringList(node.expression, field, id);
  if (!ts.isArrayLiteralExpression(node)) {
    problems.push(`In ${ROUTES_FILE}, "${id}" needs ${field} written out as a list, like ['a', 'b'].`);
    return [];
  }
  return node.elements.map((element) => stringValue(element)).filter((value): value is string => value !== null);
}

interface RouteEntry {
  id: string;
  path: string;
  title: string;
  designScreen: string | null;
  roles: string[];
  states: string[];
  page: string | null;
}

function readRoutes(): RouteEntry[] {
  const source = parse(ROUTES_FILE);
  const { names } = importsOf(ROUTES_FILE, source);
  let table: ts.ArrayLiteralExpression | null = null;
  source.forEachChild(function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'routes') {
      let init = node.initializer;
      while (init && (ts.isAsExpression(init) || ts.isSatisfiesExpression(init))) init = init.expression;
      if (init && ts.isArrayLiteralExpression(init)) table = init;
    }
    node.forEachChild(visit);
  });
  if (!table) {
    problems.push(`Couldn't find "export const routes = [...]" in ${ROUTES_FILE}.`);
    return [];
  }
  const entries: RouteEntry[] = [];
  for (const element of (table as ts.ArrayLiteralExpression).elements) {
    if (!ts.isObjectLiteralExpression(element)) {
      problems.push(`Every entry in ${ROUTES_FILE} must be written out as { id, path, page, ... }.`);
      continue;
    }
    const props = new Map<string, ts.Expression>();
    for (const prop of element.properties) {
      if (ts.isPropertyAssignment(prop) && (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))) {
        props.set(prop.name.text, prop.initializer);
      } else if (ts.isShorthandPropertyAssignment(prop)) {
        props.set(prop.name.text, prop.name);
      }
    }
    const id = stringValue(props.get('id')) ?? '';
    const path = stringValue(props.get('path')) ?? '';
    if (!id || !path) problems.push(`An entry in ${ROUTES_FILE} is missing a written-out id or path.`);
    const pageNode = props.get('page');
    const page = pageNode && ts.isIdentifier(pageNode) ? (names.get(pageNode.text) ?? null) : null;
    if (!page || !page.startsWith('src/'))
      problems.push(`In ${ROUTES_FILE}, "${id}" needs page: set to an imported page.`);
    entries.push({
      id,
      path,
      title: stringValue(props.get('title')) ?? id,
      designScreen: stringValue(props.get('designScreen')),
      roles: stringList(props.get('roles'), 'roles', id),
      states: stringList(props.get('states'), 'states', id),
      page: page && page.startsWith('src/') ? page : null,
    });
  }
  return entries;
}

/** A link target as written in code: literal text, with ${...} parts replaced by a marker. */
function linkTarget(node: ts.Expression | undefined): string | null {
  if (!node) return null;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node)) return linkTarget(node.expression);
  const literal = stringValue(node);
  if (literal !== null) return literal;
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => `\u0000${span.literal.text}`).join('');
  }
  if (ts.isObjectLiteralExpression(node)) {
    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'pathname') {
        return linkTarget(prop.initializer);
      }
    }
  }
  return null;
}

function routeMatches(routePath: string, target: string) {
  const clean = target.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  const want = routePath.replace(/\/+$/, '') || '/';
  const a = want.split('/');
  const b = clean.split('/');
  if (a.length !== b.length) return false;
  return a.every((segment, index) => {
    const other = b[index];
    if (segment.startsWith(':')) return other.length > 0;
    return segment === other;
  });
}

/** Link targets, component files and other findings for one page and the components it uses. */
function readPage(
  entry: RouteEntry,
  routes: RouteEntry[],
): { files: string[]; linksTo: string[]; findings: PageFindings } {
  const findings: PageFindings = {
    id: entry.id,
    page: entry.page ?? '',
    unknownLinks: [],
    drawsStates: false,
    dataLiterals: 0,
    outsideImports: [],
  };
  if (!entry.page) return { files: [], linksTo: [], findings };

  const files = [entry.page];
  const targets: string[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const source = parse(file);
    const { files: imported } = importsOf(file, source);
    for (const target of imported) {
      if (target.startsWith(COMPONENTS_DIR) && !files.includes(target)) files.push(target);
      if (file === entry.page && target.startsWith('src/') && !isAllowedPageImport(target)) {
        findings.outsideImports.push(target);
      }
    }
    const text = source.getFullText();
    if (file === entry.page) {
      findings.drawsStates = /<DataState\b/.test(text) || ALL_STATES.every((state) => text.includes(`'${state}'`));
    }
    source.forEachChild(function visit(node) {
      if (ts.isJsxAttribute(node) && ts.isIdentifier(node.name) && /^(to|href)$/.test(node.name.text)) {
        const init = node.initializer;
        let target: string | null = null;
        if (init && ts.isStringLiteral(init)) target = init.text;
        else if (init && ts.isJsxExpression(init)) target = linkTarget(init.expression);
        if (target) targets.push(target);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        /^(navigate|redirect)$/.test(node.expression.text)
      ) {
        const target = linkTarget(node.arguments[0]);
        if (target) targets.push(target);
      }
      if (file === entry.page && ts.isArrayLiteralExpression(node)) {
        if (node.elements.filter((element) => ts.isObjectLiteralExpression(element)).length >= 2)
          findings.dataLiterals++;
      }
      node.forEachChild(visit);
    });
  }

  const linksTo: string[] = [];
  for (const target of targets) {
    if (!target.startsWith('/')) continue;
    const match = routes.find((route) => routeMatches(route.path, target));
    if (match) {
      if (match.id !== entry.id && !linksTo.includes(match.id)) linksTo.push(match.id);
    } else if (!/^\/(screens|sign-in)\b/.test(target)) {
      findings.unknownLinks.push(target.split('\u0000').join('…'));
    }
  }
  return {
    files: files.sort((a, b) => (a === entry.page ? -1 : b === entry.page ? 1 : a.localeCompare(b))),
    linksTo,
    findings,
  };
}

function isAllowedPageImport(target: string) {
  return (
    target.startsWith(COMPONENTS_DIR) ||
    target.startsWith('src/pages/') ||
    target === 'src/data/hooks.ts' ||
    target === 'src/data/index.ts' ||
    target === 'src/routes.ts'
  );
}

function buildMap(): { map: PrototypeMap; findings: PageFindings[] } {
  const routes = readRoutes();
  const findings: PageFindings[] = [];
  const screens = routes.map((entry): MapScreen => {
    const page = readPage(entry, routes);
    findings.push(page.findings);
    return {
      id: entry.id,
      path: entry.path,
      title: entry.title,
      designScreen: entry.designScreen,
      linksTo: page.linksTo,
      states: entry.states,
      roles: entry.roles,
      files: page.files,
    };
  });
  const starterVersion = existsSync(join(ROOT, 'tools/starter-version')) ? read('tools/starter-version').trim() : '';
  return { map: { starterVersion, screens }, findings };
}

function cell(values: string[]) {
  return values.length ? values.join(', ') : '—';
}

function markdown(map: PrototypeMap) {
  const lines = [
    '# Prototype map',
    '',
    'Every screen in the prototype, written by `tools/screen-map.ts` from `src/routes.ts`. Do not edit by hand.',
    '',
    `Starter version ${map.starterVersion}. ${map.screens.length} screen${map.screens.length === 1 ? '' : 's'}.`,
    '',
  ];
  if (map.screens.length === 0) {
    lines.push('No screens yet.', '');
    return lines.join('\n');
  }
  lines.push(
    '| Screen | Address | Design screen | Links to | States | Who | Files |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  );
  for (const screen of map.screens) {
    lines.push(
      `| ${screen.title} (\`${screen.id}\`) | \`${screen.path}\` | ${screen.designScreen ?? '—'} | ${cell(screen.linksTo)} | ${cell(screen.states)} | ${screen.roles.length ? screen.roles.join(', ') : 'anyone'} | ${screen.files.map((file) => `\`${file}\``).join('<br>')} |`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

/** Pretty JSON with short lists of strings kept on one line, as in the brief's example. */
function toJson(map: PrototypeMap) {
  const text = JSON.stringify(map, null, 2).replace(
    /\[\s*((?:"(?:[^"\\]|\\.)*",?\s*)*)\]/g,
    (_, items: string) => `[${(items.match(/"(?:[^"\\]|\\.)*"/g) ?? []).join(', ')}]`,
  );
  return `${text}\n`;
}

function writeIfChanged(file: string, content: string) {
  const full = join(ROOT, file);
  if (existsSync(full) && readFileSync(full, 'utf8') === content) return;
  writeFileSync(full, content);
}

/** Plain-words checks for "ready for sign-off". Returns the list of things to fix. */
function check(map: PrototypeMap, findings: PageFindings[]) {
  const issues: string[] = [];
  const notes: string[] = [];
  for (const screen of map.screens) {
    const found = findings.find((finding) => finding.id === screen.id);
    const missing = ALL_STATES.filter((state) => !screen.states.includes(state));
    if (missing.length)
      issues.push(`"${screen.title}" doesn't list these states in the route table: ${missing.join(', ')}.`);
    if (found && !found.drawsStates)
      issues.push(`"${screen.title}" (${found.page}) doesn't draw its states: use DataState.`);
    if (found?.outsideImports.length) {
      issues.push(
        `"${screen.title}" uses ${found.outsideImports.join(', ')}; pages use only components and the data hooks.`,
      );
    }
    if (found?.dataLiterals) {
      notes.push(
        `"${screen.title}" (${found.page}) has lists of objects in it. If they are records, move them to src/data/mock/.`,
      );
    }
    for (const link of found?.unknownLinks ?? [])
      issues.push(`"${screen.title}" links to ${link}, which has no screen.`);
  }

  const handoffFile = 'design/handoff-map.json';
  if (existsSync(join(ROOT, handoffFile))) {
    const handoff = JSON.parse(read(handoffFile)) as HandoffMap;
    const byDesign = new Map(map.screens.filter((s) => s.designScreen).map((s) => [s.designScreen as string, s]));
    const idToDesign = new Map(map.screens.map((s) => [s.id, s.designScreen ?? s.id]));
    for (const designed of handoff.screens) {
      const screen = byDesign.get(designed.id);
      if (!screen) {
        issues.push(`The design's screen "${designed.title ?? designed.id}" isn't in the prototype yet.`);
        continue;
      }
      const ours = screen.linksTo.map((id) => idToDesign.get(id) ?? id);
      const missingLinks = designed.linksTo.filter((id) => !ours.includes(id));
      const extraLinks = ours.filter((id) => !designed.linksTo.includes(id));
      if (missingLinks.length)
        issues.push(`"${screen.title}" should link to ${missingLinks.join(', ')}, as in the design.`);
      if (extraLinks.length)
        notes.push(`"${screen.title}" also links to ${extraLinks.join(', ')}, which the design doesn't.`);
    }
    for (const screen of map.screens) {
      if (screen.designScreen && !handoff.screens.some((designed) => designed.id === screen.designScreen)) {
        notes.push(
          `"${screen.title}" names design screen "${screen.designScreen}", which isn't in the handoff's list.`,
        );
      }
    }
  } else if (map.screens.length) {
    notes.push(`There is no ${handoffFile}, so the screens weren't compared with the design's own list.`);
  }
  return { issues, notes };
}

function lastSignOffTag(): string | null {
  try {
    const tags = execFileSync('git', ['tag', '--list', 'sign-off/*', '--sort=-creatordate'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    return tags.split('\n').find(Boolean) ?? null;
  } catch {
    return null;
  }
}

function changesSinceSignOff(map: PrototypeMap) {
  const tag = lastSignOffTag();
  const lines = ['# Changes since sign-off', ''];
  if (!tag) {
    lines.push('Nothing has been signed off yet, so every screen is new.', '');
    for (const screen of map.screens) lines.push(`- **${screen.title}** (\`${screen.path}\`)`);
    lines.push('');
    return lines.join('\n');
  }
  let before: PrototypeMap = { starterVersion: '', screens: [] };
  try {
    before = JSON.parse(execFileSync('git', ['show', `${tag}:prototype-map.json`], { cwd: ROOT, encoding: 'utf8' }));
  } catch {
    // The tagged commit has no map; treat everything as new.
  }
  let changedFiles: string[] = [];
  try {
    changedFiles = execFileSync('git', ['diff', '--name-only', tag, '--', 'src'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n')
      .filter(Boolean);
  } catch {
    // Not a git checkout.
  }
  const added = map.screens.filter((screen) => !before.screens.some((old) => old.id === screen.id));
  const removed = before.screens.filter((old) => !map.screens.some((screen) => screen.id === old.id));
  const changed: string[] = [];
  for (const screen of map.screens) {
    const old = before.screens.find((candidate) => candidate.id === screen.id);
    if (!old) continue;
    const what: string[] = [];
    if (old.title !== screen.title) what.push(`renamed from "${old.title}"`);
    if (old.path !== screen.path) what.push(`moved from \`${old.path}\``);
    const gained = screen.linksTo.filter((id) => !old.linksTo.includes(id));
    const lost = old.linksTo.filter((id) => !screen.linksTo.includes(id));
    if (gained.length) what.push(`now links to ${gained.join(', ')}`);
    if (lost.length) what.push(`no longer links to ${lost.join(', ')}`);
    if (old.roles.join() !== screen.roles.join()) what.push(`now for ${screen.roles.join(', ') || 'anyone'}`);
    const touched = screen.files.filter((file) => changedFiles.includes(file));
    if (touched.length) what.push(`changed in ${touched.map((file) => `\`${file}\``).join(', ')}`);
    if (what.length) changed.push(`- **${screen.title}** (\`${screen.path}\`): ${what.join('; ')}`);
  }
  lines.push(`Compared with the sign-off tagged \`${tag}\`.`, '');
  lines.push(
    '## New screens',
    '',
    ...(added.length ? added.map((s) => `- **${s.title}** (\`${s.path}\`)`) : ['None.']),
    '',
  );
  lines.push('## Changed screens', '', ...(changed.length ? changed : ['None.']), '');
  lines.push(
    '## Removed screens',
    '',
    ...(removed.length ? removed.map((s) => `- **${s.title}** (\`${s.path}\`)`) : ['None.']),
    '',
  );
  const shared = changedFiles.filter((file) => /^src\/(data|styles|components)\//.test(file));
  if (shared.length) {
    lines.push('## Shared changes', '', 'These can change how several screens look or behave:', '');
    lines.push(...shared.map((file) => `- \`${file}\``), '');
  }
  return lines.join('\n');
}

const args = process.argv.slice(2);
const { map, findings } = buildMap();
writeIfChanged('prototype-map.json', toJson(map));
writeIfChanged('PROTOTYPE-MAP.md', markdown(map));

if (args.includes('--changes')) writeIfChanged('CHANGES-SINCE-SIGN-OFF.md', changesSinceSignOff(map));

if (problems.length) {
  console.error(['The screen map could not be fully written:', ...problems.map((p) => `- ${p}`)].join('\n'));
  process.exitCode = 1;
}

if (args.includes('--check')) {
  const { issues, notes } = check(map, findings);
  console.log(`${map.screens.length} screen${map.screens.length === 1 ? '' : 's'} on the screen map.`);
  if (issues.length) console.log(['To fix before sign-off:', ...issues.map((issue) => `- ${issue}`)].join('\n'));
  else console.log('Every screen lists and draws its four states, and every link goes to a screen.');
  if (notes.length) console.log(['Worth a look:', ...notes.map((note) => `- ${note}`)].join('\n'));
  if (issues.length) process.exitCode = 1;
}
