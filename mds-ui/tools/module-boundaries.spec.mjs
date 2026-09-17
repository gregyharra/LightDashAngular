import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
console.log('module-boundaries config markers OK');
