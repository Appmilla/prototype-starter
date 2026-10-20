// PostToolUse hook for Write and Edit: refresh the screen map, then run the type check and lint.
// Quiet when everything passes. When something fails it prints what failed and exits 2, so Claude sees it and
// fixes it before carrying on.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function editedFile() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
    return input.tool_input?.file_path ?? null;
  } catch {
    return null;
  }
}

/** Only edits to the app, the tools or the handoff's screen list can change what these checks see. */
function matters(file) {
  if (!file) return true;
  const path = relative(ROOT, resolve(ROOT, file)).split('\\').join('/');
  if (path.startsWith('..')) return false;
  return (
    /^(src|tools)\//.test(path) ||
    path === 'design/handoff-map.json' ||
    /^(package\.json|tsconfig.*\.json|eslint\.config\.js)$/.test(path)
  );
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() };
}

if (!matters(editedFile())) process.exit(0);

if (!existsSync(join(ROOT, 'node_modules'))) {
  const install = run('npm', ['ci', '--silent', '--no-audit', '--no-fund']);
  if (!install.ok) {
    console.error(`Installing the prototype's packages failed:\n${install.output}`);
    process.exit(2);
  }
}

const checks = [
  ['Screen map', process.execPath, ['--disable-warning=ExperimentalWarning', 'tools/screen-map.ts']],
  ['Type check', process.execPath, ['node_modules/typescript/bin/tsc', '-b']],
  ['Lint', process.execPath, ['node_modules/eslint/bin/eslint.js', '--max-warnings', '0', '.']],
];

const failures = [];
for (const [name, command, args] of checks) {
  const result = run(command, args);
  if (!result.ok) failures.push(`${name} failed:\n${result.output}`);
}

if (failures.length) {
  console.error(failures.join('\n\n'));
  process.exit(2);
}
