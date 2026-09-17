import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEslintConfig() {
  // Prefer flat config; fall back to .eslintrc.json
  try {
    return readFileSync(join(root, 'eslint.config.mjs'), 'utf8');
  } catch {
    return readFileSync(join(root, '.eslintrc.json'), 'utf8');
  }
}

const text = loadEslintConfig();
assert.match(text, /@nx\/enforce-module-boundaries/);
assert.match(text, /enforceBuildableLibDependency/);
assert.match(text, /type:models/);
assert.match(text, /type:core/);
assert.match(text, /type:shared/);
assert.match(text, /type:feature/);
assert.match(text, /type:app/);
assert.doesNotMatch(text, /remote-(?:auth|projects|warehouses|tables)\/Routes/);

const shellConfig = readFileSync(
  join(root, 'apps/shell/eslint.config.mjs'),
  'utf8',
);
for (const remote of ['auth', 'projects', 'warehouses', 'tables']) {
  assert.match(shellConfig, new RegExp(`remote-${remote}/Routes`));
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : /\.(?:[cm]?[jt]s|tsx)$/.test(entry.name)
        ? [path]
        : [];
  });
}

const appsDirectory = join(root, 'apps');
for (const remote of readdirSync(appsDirectory, { withFileTypes: true }).filter(
  (entry) => entry.isDirectory() && entry.name.startsWith('remote-'),
)) {
  for (const path of sourceFiles(join(appsDirectory, remote.name, 'src'))) {
    assert.doesNotMatch(
      readFileSync(path, 'utf8'),
      /(?:from\s+|import\s*\()\s*['"]remote-/,
      `${path} must not import another remote`,
    );
  }
}
console.log('module-boundaries config markers OK');
