// Checks the design's colours for WCAG AA contrast, in light and dark, before any screens are built.
//
//   node tools/contrast.ts [tokens.css] [components.css]
//
// Defaults to src/styles/tokens.css and src/styles/components.css. It checks every rule that sets a text colour and
// a background together (directly, or as a pair of its own --*-bg / --*-fg properties), resolving var(--token)
// through the light and dark token blocks. Text needs 4.5:1, or 3:1 when large (24px, or 18.5px and bold).
// Colours on inherited backgrounds aren't checked here: the accessibility scan at sign-off checks what renders.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

interface Block {
  /** Selectors and at-rules this block sits inside, outermost first, ending with its own selector. */
  context: string[];
  declarations: Map<string, string>;
}

/** Leaf blocks of a stylesheet, with the at-rules around them. */
function parse(css: string): Block[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: Block[] = [];
  const stack: string[] = [];
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '{') {
      stack.push(text.slice(start, index).trim());
      start = index + 1;
    } else if (char === '}') {
      const body = text.slice(start, index);
      const declarations = new Map<string, string>();
      for (const part of body.split(';')) {
        const colon = part.indexOf(':');
        if (colon > 0) declarations.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim());
      }
      if (declarations.size) blocks.push({ context: [...stack], declarations });
      stack.pop();
      start = index + 1;
    } else if (char === ';' && stack.length === 0) {
      start = index + 1;
    }
  }
  return blocks;
}

const isDark = (context: string[]) =>
  context.some((part) => /data-theme\s*=\s*["']?dark|prefers-color-scheme:\s*dark|\.dark\b/i.test(part));

type Tokens = Map<string, string>;

function themes(blocks: Block[]): { light: Tokens; dark: Tokens } {
  const light: Tokens = new Map();
  const darkOnly: Tokens = new Map();
  for (const block of blocks) {
    for (const [name, value] of block.declarations) {
      if (!name.startsWith('--')) continue;
      (isDark(block.context) ? darkOnly : light).set(name, value);
    }
  }
  return { light, dark: new Map([...light, ...darkOnly]) };
}

const NAMED: Record<string, string> = { white: '#ffffff', black: '#000000' };

/** Resolves var() chains and returns the colour as #rrggbb, or null when it isn't one solid colour. */
function color(value: string | undefined, tokens: Tokens, local: Tokens, depth = 0): string | null {
  if (!value || depth > 10) return null;
  const v = value.trim().toLowerCase();
  const variable = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (variable) {
    const found = local.get(variable[1]) ?? tokens.get(variable[1]);
    return color(found ?? variable[2], tokens, local, depth + 1);
  }
  if (NAMED[v]) return NAMED[v];
  const hex = v.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map((d) => d + d).join('');
    if (digits.length === 8 && digits.slice(6) !== 'ff') return null;
    return digits.length >= 6 ? `#${digits.slice(0, 6)}` : null;
  }
  const rgb = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    if (rgb[4] !== undefined && parseFloat(rgb[4]) < (rgb[4].endsWith('%') ? 100 : 1)) return null;
    return `#${[rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  }
  return null;
}

/** The colour part of a `background` shorthand, when it is a single colour. */
function backgroundColor(value: string | undefined) {
  if (!value) return undefined;
  if (/gradient|url\(/i.test(value)) return undefined;
  return value.split(/\s+(?![^(]*\))/)[0];
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** True when the rule's text counts as large: 24px, or 18.5px and bold. */
function isLarge(declarations: Map<string, string>) {
  const font = declarations.get('font') ?? '';
  const size = parseFloat(declarations.get('font-size') ?? font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '0');
  const weight = parseInt(declarations.get('font-weight') ?? font.match(/\b([1-9]00)\b/)?.[1] ?? '400', 10);
  return size >= 24 || (size >= 18.5 && weight >= 700);
}

/** Classes the design's markup always shows in dark (data-theme="dark" on the same element). */
function alwaysDarkClasses(dirs: string[]) {
  const classes = new Set<string>();
  const visit = (dir: string, depth: number) => {
    if (depth > 6 || !existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const path = resolve(dir, name);
      if (statSync(path).isDirectory()) visit(path, depth + 1);
      else if (/\.(html|tsx|jsx)$/.test(name)) {
        for (const tag of readFileSync(path, 'utf8').match(/<[a-z][^>]*data-theme=["']dark["'][^>]*>/gi) ?? []) {
          const list = tag.match(/class(?:Name)?=["']([^"']+)["']/)?.[1] ?? '';
          for (const cls of list.split(/\s+/)) if (cls) classes.add(cls);
        }
      }
    }
  };
  for (const dir of new Set(dirs)) visit(dir, 0);
  return classes;
}

interface Problem {
  selector: string;
  theme: string;
  foreground: string;
  background: string;
  ratio: number;
  needed: number;
}

function check(tokensFile: string, componentsFile: string, darkClasses: Set<string>) {
  const tokenBlocks = parse(readFileSync(tokensFile, 'utf8'));
  const componentBlocks = parse(readFileSync(componentsFile, 'utf8'));
  const { light, dark } = themes([...tokenBlocks, ...componentBlocks]);
  const problems: Problem[] = [];
  let pairs = 0;

  for (const block of componentBlocks) {
    const local: Tokens = new Map([...block.declarations].filter(([name]) => name.startsWith('--')));
    const candidates: [string | undefined, string | undefined][] = [
      [
        block.declarations.get('color'),
        block.declarations.get('background-color') ?? backgroundColor(block.declarations.get('background')),
      ],
    ];
    for (const [name, value] of local) {
      const pair = name.match(/^(--[\w-]*?)-?(bg|background)$/);
      if (!pair) continue;
      for (const suffix of ['fg', 'text', 'color', 'ink']) {
        const fg = local.get(`${pair[1]}-${suffix}`);
        if (fg) candidates.push([fg, value]);
      }
    }
    const selector = block.context[block.context.length - 1];
    const firstClass = selector.match(/^\.([\w-]+)/)?.[1] ?? '';
    const blockThemes: [string, Tokens][] =
      isDark(block.context) || darkClasses.has(firstClass)
        ? [['dark', dark]]
        : [
            ['light', light],
            ['dark', dark],
          ];
    for (const [fgValue, bgValue] of candidates) {
      if (!fgValue || !bgValue) continue;
      for (const [theme, tokens] of blockThemes) {
        const foreground = color(fgValue, tokens, local);
        const background = color(bgValue, tokens, local);
        if (!foreground || !background) continue;
        pairs++;
        const needed = isLarge(block.declarations) ? 3 : 4.5;
        const value = ratio(foreground, background);
        if (value < needed) problems.push({ selector, theme, foreground, background, ratio: value, needed });
      }
    }
  }
  return { pairs, problems };
}

const [tokensArg, componentsArg] = process.argv.slice(2);
const tokensFile = resolve(ROOT, tokensArg ?? 'src/styles/tokens.css');
const componentsFile = resolve(ROOT, componentsArg ?? 'src/styles/components.css');
for (const file of [tokensFile, componentsFile]) {
  if (!existsSync(file)) {
    console.error(`Can't find ${file}. Give the design's tokens and component stylesheets.`);
    process.exit(1);
  }
}

const darkClasses = alwaysDarkClasses([
  resolve(ROOT, 'design'),
  resolve(ROOT, 'src'),
  dirname(dirname(componentsFile)),
]);
const { pairs, problems } = check(tokensFile, componentsFile, darkClasses);
if (pairs === 0) {
  console.log('No rule sets a text colour and a background together, so there was nothing to check here.');
} else if (problems.length === 0) {
  console.log(`All ${pairs} text and background pairs meet WCAG AA contrast, in light and dark.`);
} else {
  const line = (p: Problem) =>
    `- ${p.selector} (${p.theme}): ${p.foreground} on ${p.background} is ${p.ratio.toFixed(2)}:1`;
  const failing = problems.filter((p) => p.ratio < 3);
  const textOnly = problems.filter((p) => p.ratio >= 3);
  if (failing.length) {
    console.log('Too low for anything, text or icons (below 3:1):');
    failing.forEach((p) => console.log(line(p)));
  }
  if (textOnly.length) {
    console.log("Too low for normal-size text (needs 4.5:1), but fine if it's an icon or large text (3:1):");
    textOnly.forEach((p) => console.log(line(p)));
  }
  console.log(`${problems.length} of ${pairs} pairs need a look.`);
  process.exitCode = 1;
}
