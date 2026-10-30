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
assert.doesNotMatch(text, /remote-[a-z]+\/Routes/);

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

// No remotes remain and nothing may import a `remote-*` alias.
const appsDirectory = join(root, 'apps');
for (const entry of readdirSync(appsDirectory, { withFileTypes: true })) {
  assert.ok(
    !entry.name.startsWith('remote-'),
    `apps/${entry.name} must be migrated into libs/features`,
  );
}

// Feature libs must not import other feature libs.
const featuresDirectory = join(root, 'libs/features');
for (const feature of readdirSync(featuresDirectory, { withFileTypes: true }).filter(
  (entry) => entry.isDirectory(),
)) {
  for (const path of sourceFiles(join(featuresDirectory, feature.name, 'src'))) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      source,
      /(?:from\s+|import\s*\()\s*['"]remote-/,
      `${path} must not import a remote`,
    );
    for (const match of source.matchAll(/['"]@mds-ui\/features\/([a-z-]+)['"]/g)) {
      assert.equal(
        match[1],
        feature.name,
        `${path} must not import @mds-ui/features/${match[1]}`,
      );
    }
  }
}
console.log('module-boundaries config markers OK');
