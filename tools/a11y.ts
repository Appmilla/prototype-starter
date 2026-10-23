/// <reference lib="dom" />
// Accessibility scan for sign-off: every screen in every state, at phone and desktop width, in light and dark.
//
//   node tools/a11y.ts
//
// Builds the prototype, opens each link on /screens in a real browser and runs axe-core's WCAG 2.2 A and AA rules,
// then tabs through each screen to check that keyboard focus is visible. Writes ACCESSIBILITY-REPORT.md and prints
// a short summary. Takes a few minutes; run it before client sign-off, not after every change.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser, BrowserContext } from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4319;
const BASE = `http://localhost:${PORT}`;
const REPORT = 'ACCESSIBILITY-REPORT.md';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VARIANTS = [
  { name: 'phone, light', width: 390, height: 844, scheme: 'light' as const },
  { name: 'phone, dark', width: 390, height: 844, scheme: 'dark' as const },
  { name: 'desktop, light', width: 1280, height: 800, scheme: 'light' as const },
  { name: 'desktop, dark', width: 1280, height: 800, scheme: 'dark' as const },
];

const require = createRequire(import.meta.url);
let chromium: typeof import('playwright').chromium;
let axeSource: string;
try {
  ({ chromium } = await import('playwright'));
  axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
} catch {
  console.error(
    'The accessibility scan needs two packages: npm install --save-dev --save-exact playwright@1.63.0 axe-core@4.14.0',
  );
  process.exit(1);
}

interface Target {
  screen: string;
  state: string;
  href: string;
}

interface Finding {
  rule: string;
  impact: string;
  help: string;
  helpUrl: string;
  where: Set<string>;
  example: string;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function build() {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0)
    fail(`The prototype doesn't build, so it can't be scanned:\n${result.stdout}${result.stderr}`);
}

async function startPreview() {
  const server = spawn(
    process.execPath,
    [join(ROOT, 'node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'],
    {
      cwd: ROOT,
      stdio: 'ignore',
    },
  );
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(BASE)).ok) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 200));
  }
  server.kill();
  return fail(`The preview server didn't start on port ${PORT}.`);
}

/** Chromium from Playwright; falls back to a browser already on the machine, then installs one. */
async function launch(): Promise<Browser> {
  try {
    return await chromium.launch();
  } catch {
    const local = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, '/opt/pw-browsers/chromium'].find(
      (path) => path && existsSync(path),
    );
    if (local) {
      try {
        return await chromium.launch({ executablePath: local });
      } catch {
        // Fall through to installing.
      }
    }
    console.log('Installing the browser the scan uses (once per computer)…');
    const install = spawnSync(process.execPath, [join(ROOT, 'node_modules/playwright/cli.js'), 'install', 'chromium'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    if (install.status !== 0) fail('Couldn’t install the browser for the accessibility scan.');
    return chromium.launch();
  }
}

async function targets(browser: Browser): Promise<Target[]> {
  const page = await browser.newPage();
  await page.goto(`${BASE}/screens`);
  const rows = await page.$$eval('.dev-table tbody tr', (trs) =>
    trs.map((tr) => {
      const links = [...tr.querySelectorAll('a')];
      return {
        screen: links[0]?.textContent?.trim() ?? '',
        links: links.map((a, index) => ({
          state: index === 0 ? 'normal' : (a.textContent?.trim().toLowerCase() ?? ''),
          href: a.getAttribute('href') ?? '',
        })),
      };
    }),
  );
  await page.close();
  return rows.flatMap((row) => row.links.map((link) => ({ screen: row.screen, state: link.state, href: link.href })));
}

async function scan(context: BrowserContext, target: Target, variant: string, findings: Map<string, Finding>) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}${target.href}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async (tags) => {
      const axe = (
        window as unknown as { axe: { run: (c: Document, o: object) => Promise<{ violations: unknown[] }> } }
      ).axe;
      const result = await axe.run(document, { runOnly: { type: 'tag', values: tags } });
      return result.violations as {
        id: string;
        impact: string;
        help: string;
        helpUrl: string;
        nodes: { target: string[]; html: string }[];
      }[];
    }, AXE_TAGS);
    for (const violation of violations) {
      const finding = findings.get(violation.id) ?? {
        rule: violation.id,
        impact: violation.impact ?? 'minor',
        help: violation.help,
        helpUrl: violation.helpUrl,
        where: new Set<string>(),
        example: violation.nodes[0]?.html.slice(0, 160) ?? '',
      };
      finding.where.add(`${target.screen} (${target.state}, ${variant})`);
      findings.set(violation.id, finding);
    }
  } finally {
    await page.close();
  }
}

/** Tabs through the page; returns the elements that show no visible change when focused. */
async function keyboard(context: BrowserContext, target: Target) {
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}${target.href}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const unseen: string[] = [];
    for (let step = 0; step < 25; step++) {
      await page.keyboard.press('Tab');
      const result = await page.evaluate(() => {
        const element = document.activeElement as HTMLElement | null;
        if (!element || element === document.body) return null;
        const look = () => {
          const style = getComputedStyle(element);
          return [
            style.outlineStyle,
            style.outlineWidth,
            style.boxShadow,
            style.borderColor,
            style.backgroundColor,
            style.textDecorationLine,
          ].join('|');
        };
        const focused = look();
        element.blur();
        const unfocused = look();
        element.focus();
        const name = `${element.tagName.toLowerCase()} "${(element.textContent ?? element.getAttribute('aria-label') ?? '').trim().slice(0, 40)}"`;
        return { name, visible: focused !== unfocused };
      });
      if (!result) break;
      if (!result.visible && !unseen.includes(result.name)) unseen.push(result.name);
    }
    return unseen;
  } finally {
    await page.close();
  }
}

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor'];

function report(all: Target[], findings: Map<string, Finding>, focus: Map<string, string[]>) {
  const screens = new Set(all.map((target) => target.screen));
  const sorted = [...findings.values()].sort(
    (a, b) => IMPACT_ORDER.indexOf(a.impact) - IMPACT_ORDER.indexOf(b.impact) || b.where.size - a.where.size,
  );
  const lines = [
    '# Accessibility report',
    '',
    `Written by \`tools/a11y.ts\` on ${new Date().toISOString().slice(0, 10)}: ${screens.size} screens, ${all.length} screen states, each at phone and desktop width in light and dark, checked against WCAG 2.2 A and AA with axe-core, plus a keyboard focus check.`,
    '',
    'Automated checks find roughly a third to a half of accessibility problems. Screen-reader and keyboard walk-throughs by a person are still needed before production.',
    '',
  ];
  if (!sorted.length) lines.push('## Problems found', '', 'None.', '');
  else {
    lines.push('## Problems found', '');
    for (const finding of sorted) {
      const where = [...finding.where];
      lines.push(
        `### ${finding.help} (${finding.impact})`,
        '',
        `Rule \`${finding.rule}\`, [how to fix](${finding.helpUrl}). Found in ${where.length} place${where.length === 1 ? '' : 's'}, for example \`${finding.example.replace(/`/g, "'")}\`.`,
        '',
        ...where.slice(0, 12).map((place) => `- ${place}`),
        ...(where.length > 12 ? [`- and ${where.length - 12} more`] : []),
        '',
      );
    }
  }
  const unseen = [...focus.entries()].filter(([, names]) => names.length);
  lines.push('## Keyboard focus', '');
  if (!unseen.length) lines.push('Every element reached with Tab shows a visible change when focused.', '');
  else {
    lines.push('These elements show no visible change when focused with Tab:', '');
    for (const [screen, names] of unseen) lines.push(`- ${screen}: ${names.join(', ')}`);
    lines.push('');
  }
  writeFileSync(join(ROOT, REPORT), lines.join('\n'));
  return { sorted, unseen, screens: screens.size };
}

async function main() {
  build();
  const server = await startPreview();
  const browser = await launch();
  try {
    const all = await targets(browser);
    if (!all.length) {
      console.log('No screens yet, so there is nothing to scan.');
      return;
    }
    console.log(`Scanning ${all.length} screen states in ${VARIANTS.length} views each…`);
    const findings = new Map<string, Finding>();
    await Promise.all(
      VARIANTS.map(async (variant) => {
        const context = await browser.newContext({
          viewport: { width: variant.width, height: variant.height },
          colorScheme: variant.scheme,
        });
        if (variant.scheme === 'dark') {
          await context.addInitScript(() => document.documentElement.setAttribute('data-theme', 'dark'));
        }
        for (const target of all) await scan(context, target, variant.name, findings);
        await context.close();
      }),
    );
    const focus = new Map<string, string[]>();
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    for (const target of all.filter((t) => t.state === 'normal'))
      focus.set(target.screen, await keyboard(context, target));
    await context.close();

    const { sorted, unseen, screens } = report(all, findings, focus);
    if (!sorted.length && !unseen.length) {
      console.log(`No accessibility problems found on ${screens} screens. Report: ${REPORT}`);
    } else {
      console.log(`Accessibility problems on ${screens} screens (details in ${REPORT}):`);
      for (const finding of sorted) console.log(`- ${finding.help} (${finding.impact}): ${finding.where.size} places`);
      if (unseen.length) console.log(`- Focus not visible on ${unseen.length} screen${unseen.length === 1 ? '' : 's'}`);
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    server.kill();
  }
}

await main();
