# Classic Webpack ModuleFederationPlugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Nx `withModuleFederation` with classic `webpack/lib/container/ModuleFederationPlugin` and an explicit shared singleton map so Material tables render correctly under the shell.

**Architecture:** One `mds-ui/webpack.mf.base.ts` factory builds classic MF plugins + `shared`. Every app webpack config merges that plugin into the Angular webpack config. Shell remotes use localhost ports; remotes expose `./Routes`.

**Tech Stack:** Angular 20, webpack 5 (via `@angular-devkit/build-angular` / `@nx/angular:webpack-browser`), `webpack/lib/container/ModuleFederationPlugin`, Nx 23.

**Spec:** `docs/superpowers/specs/2026-09-24-mf-explicit-shared-singletons-design.md`

## Global Constraints

- Plugin MUST be `webpack/lib/container/ModuleFederationPlugin` (company standard), not `@module-federation/enhanced`.
- Do NOT use `withModuleFederation` from `@nx/module-federation/angular` after migration.
- Explicit `shared` MUST include `@angular/core`, `@angular/common`, `@angular/common/http`, `@angular/animations`, `@angular/platform-browser`, `@angular/platform-browser-dynamic`, `@angular/router`, `@angular/forms`, `@angular/cdk`, `@angular/material`, `rxjs`, `rxjs/operators`, `@ngrx/store`, `@ngx-translate/core` as `{ singleton: true, strictVersion: true, requiredVersion: '<version from mds-ui/package.json dependencies>' }`.
- Keep shell route imports: `import('remote-auth/Routes')` etc.
- Do NOT introduce plain-HTML table workarounds.
- Prefer relative imports to `webpack.mf.base` from `apps/<name>/`.

---

## File structure

| File | Responsibility |
|------|----------------|
| `mds-ui/webpack.mf.base.ts` | `mfShared`, remote port map, `createMfPlugin`, `withClassicModuleFederation` |
| `mds-ui/webpack.mf.base.spec.ts` | Unit tests for shared keys + plugin constructor options |
| `mds-ui/apps/*/webpack.config.ts` | Dev: classic MF via base helper |
| `mds-ui/apps/*/webpack.prod.config.ts` | Prod: same exposes/remotes; prod remote URL stubs |
| `mds-ui/apps/shell/project.json` | Serve target if MF dev-server must change |
| Delete or gut | Nx-only usage of `withModuleFederation`; keep thin exposes/remotes data if useful |

---

### Task 1: Base helper + failing tests

**Files:**
- Create: `mds-ui/webpack.mf.base.ts`
- Create: `mds-ui/webpack.mf.base.spec.ts`
- Modify: `mds-ui/tsconfig.spec.json` or add jest config only if needed so the spec runs (prefer existing root/jest patterns; if none, use a small node test via `npx jest` with a local config)

**Interfaces:**
- Produces: `mfShared`, `MF_REMOTE_PORTS`, `createMfPlugin(options)`, `withClassicModuleFederation(options)` returning `(config) => config`

- [ ] **Step 1: Write the failing test**

Create `mds-ui/webpack.mf.base.spec.ts`:

```ts
import {
  mfShared,
  createMfPlugin,
  MF_REMOTE_PORTS,
} from './webpack.mf.base';

describe('webpack.mf.base', () => {
  it('shares Angular Material and CDK as singletons', () => {
    expect(mfShared['@angular/material']).toEqual(
      expect.objectContaining({ singleton: true, strictVersion: true }),
    );
    expect(mfShared['@angular/cdk']).toEqual(
      expect.objectContaining({ singleton: true, strictVersion: true }),
    );
    expect(mfShared['@angular/core']).toEqual(
      expect.objectContaining({ singleton: true, strictVersion: true }),
    );
  });

  it('maps remote-auth to port 4201', () => {
    expect(MF_REMOTE_PORTS['remote-auth']).toBe(4201);
  });

  it('createMfPlugin uses classic container plugin and remoteEntry.js', () => {
    const plugin = createMfPlugin({
      name: 'remote-auth',
      exposes: {
        './Routes': 'apps/remote-auth/src/app/remote-entry/entry.routes.ts',
      },
    });
    expect(plugin.constructor.name).toMatch(/ModuleFederationPlugin/);
    const opts = (plugin as { _options?: Record<string, unknown> })._options
      ?? (plugin as { options?: Record<string, unknown> }).options;
    // Prefer reading via plugin options field webpack exposes; if internal, assert filename via JSON.stringify(plugin)
    const serialized = JSON.stringify(plugin);
    expect(serialized).toContain('remoteEntry.js');
    expect(serialized).toContain('remote-auth');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run from `mds-ui/`:

```bash
npx jest webpack.mf.base.spec.ts --config=jest.mf.config.ts
```

If no jest config yet, create minimal `mds-ui/jest.mf.config.ts`:

```ts
export default {
  displayName: 'mf-base',
  testEnvironment: 'node',
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json' }] },
  moduleFileExtensions: ['ts', 'js'],
  testMatch: ['<rootDir>/webpack.mf.base.spec.ts'],
};
```

Expected: FAIL (module not found or missing exports).

- [ ] **Step 3: Implement `webpack.mf.base.ts`**

```ts
import * as fs from 'fs';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');

type SharedConfig = {
  singleton: boolean;
  strictVersion: boolean;
  requiredVersion: string | false;
};

function readDepVersion(pkg: string): string {
  const pkgJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
  );
  const version =
    pkgJson.dependencies?.[pkg] ?? pkgJson.devDependencies?.[pkg];
  if (!version) {
    throw new Error(`Missing dependency ${pkg} in mds-ui/package.json`);
  }
  return version;
}

const SHARED_PACKAGES = [
  '@angular/core',
  '@angular/common',
  '@angular/common/http',
  '@angular/animations',
  '@angular/platform-browser',
  '@angular/platform-browser-dynamic',
  '@angular/router',
  '@angular/forms',
  '@angular/cdk',
  '@angular/material',
  'rxjs',
  'rxjs/operators',
  '@ngrx/store',
  '@ngx-translate/core',
] as const;

function buildShared(): Record<string, SharedConfig> {
  const shared: Record<string, SharedConfig> = {};
  for (const name of SHARED_PACKAGES) {
    const root = name.startsWith('rxjs/')
      ? 'rxjs'
      : name.startsWith('@angular/common/')
        ? '@angular/common'
        : name;
    shared[name] = {
      singleton: true,
      strictVersion: true,
      requiredVersion: readDepVersion(root),
    };
  }
  return shared;
}

export const mfShared = buildShared();

export const MF_REMOTE_PORTS: Record<string, number> = {
  'remote-auth': 4201,
  'remote-projects': 4202,
  'remote-warehouses': 4203,
  'remote-tables': 4204,
  'remote-explorer': 4205,
  'remote-charts': 4206,
  'remote-dashboards': 4207,
  'remote-lineage': 4208,
  'remote-ai': 4209,
  'remote-export': 4210,
};

export type ClassicMfOptions = {
  name: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string>;
};

export function createMfPlugin(options: ClassicMfOptions) {
  return new ModuleFederationPlugin({
    name: options.name,
    filename: 'remoteEntry.js',
    exposes: options.exposes,
    remotes: options.remotes,
    shared: mfShared,
    // Angular host dynamic import compatibility — adjust in Task 2 if build fails:
    library: { type: 'module' },
  });
}

export function withClassicModuleFederation(options: ClassicMfOptions) {
  return (config: Record<string, any>) => {
    config.output = {
      ...(config.output ?? {}),
      uniqueName: options.name,
      publicPath: 'auto',
    };
    config.experiments = {
      ...(config.experiments ?? {}),
      outputModule: true,
    };
    config.optimization = {
      ...(config.optimization ?? {}),
      runtimeChunk: false,
    };
    config.plugins = [...(config.plugins ?? []), createMfPlugin(options)];
    return config;
  };
}

export function shellDevRemotes(): Record<string, string> {
  const remotes: Record<string, string> = {};
  for (const [name, port] of Object.entries(MF_REMOTE_PORTS)) {
    // Format may need `name@url` vs bare URL — Task 2 verifies against shell build
    remotes[name] = `http://localhost:${port}/remoteEntry.js`;
  }
  return remotes;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest webpack.mf.base.spec.ts --config=jest.mf.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add mds-ui/webpack.mf.base.ts mds-ui/webpack.mf.base.spec.ts mds-ui/jest.mf.config.ts
git commit -m "feat(mds-ui): add classic ModuleFederationPlugin base helper"
```

---

### Task 2: Wire `remote-auth` + shell (prove path)

**Files:**
- Modify: `mds-ui/apps/remote-auth/webpack.config.ts`
- Modify: `mds-ui/apps/remote-auth/webpack.prod.config.ts`
- Modify: `mds-ui/apps/shell/webpack.config.ts`
- Modify: `mds-ui/apps/shell/webpack.prod.config.ts`
- Possibly modify: `mds-ui/apps/shell/project.json` serve executor

**Interfaces:**
- Consumes: `withClassicModuleFederation`, `shellDevRemotes` from `webpack.mf.base`
- Produces: working shell load of `remote-auth/Routes`

- [ ] **Step 1: Replace remote-auth webpack configs**

`webpack.config.ts`:

```ts
import {
  withClassicModuleFederation,
} from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'remote-auth',
  exposes: {
    './Routes': 'apps/remote-auth/src/app/remote-entry/entry.routes.ts',
  },
});
```

Mirror in `webpack.prod.config.ts` (same exposes).

- [ ] **Step 2: Replace shell webpack configs**

```ts
import {
  withClassicModuleFederation,
  shellDevRemotes,
} from '../../webpack.mf.base';

export default withClassicModuleFederation({
  name: 'shell',
  remotes: shellDevRemotes(),
});
```

Prod: same for now (or comment stub for deployed URLs).

- [ ] **Step 3: Build remote-auth and shell (dev config)**

```bash
cd mds-ui && npx nx build remote-auth --configuration=development
npx nx build shell --configuration=development
```

Expected: both succeed. If remoteEntry / library / remotes format errors, fix `createMfPlugin` / `shellDevRemotes` in base (e.g. switch remotes to `'remote_auth@http://localhost:4201/remoteEntry.js'` or drop `library: { type: 'module' }` / `outputModule`) until green — document the working format in a one-line comment on `createMfPlugin`.

- [ ] **Step 4: Serve smoke**

Ensure remotes are reachable. If `nx serve shell` fails because MF dev-server expects Nx configs:

- Change shell `serve` executor to `@nx/angular:dev-server` with port 4200.
- Build/serve remotes with existing `serve-static` / `nx run remote-auth:serve-static` on 4201.
- Document: `npx nx run-many -t serve-static -p remote-auth,...` then `npx nx serve shell`.

Verify Users page shows `mat-table` rows (browser or note manual check in report).

- [ ] **Step 5: Commit**

```bash
git add mds-ui/apps/remote-auth/webpack*.ts mds-ui/apps/shell/webpack*.ts mds-ui/apps/shell/project.json mds-ui/webpack.mf.base.ts
git commit -m "feat(mds-ui): wire shell and remote-auth on classic MF plugin"
```

---

### Task 3: Roll classic MF to all remaining remotes

**Files:**
- Modify: every remaining `apps/remote-*/webpack.config.ts` and `webpack.prod.config.ts`
- Optionally delete unused Nx `module-federation.config.ts` imports OR leave files unused and remove from webpack (prefer delete only if nothing else imports them; if Nx serve still reads them, keep data-only copies)

**Exposes pattern (each remote):** `./Routes` → `apps/<remote>/src/app/remote-entry/entry.routes.ts`

Remotes: `remote-projects`, `remote-warehouses`, `remote-tables`, `remote-explorer`, `remote-charts`, `remote-dashboards`, `remote-lineage`, `remote-ai`, `remote-export`.

- [ ] **Step 1: Update each remote webpack pair** to `withClassicModuleFederation({ name, exposes })` like remote-auth.

- [ ] **Step 2: Build all remotes (development)**

```bash
cd mds-ui && npx nx run-many -t build -p remote-projects,remote-warehouses,remote-tables,remote-explorer,remote-charts,remote-dashboards,remote-lineage,remote-ai,remote-export,remote-auth,shell --configuration=development
```

Expected: all succeed.

- [ ] **Step 3: Grep guard**

```bash
rg -n "withModuleFederation|@nx/module-federation/angular" mds-ui/apps --glob 'webpack*.ts'
```

Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add mds-ui/apps/*/webpack*.ts
git commit -m "feat(mds-ui): migrate all remotes to classic ModuleFederationPlugin"
```

---

### Task 4: Cleanup + start docs + final verify

**Files:**
- Modify or delete: `mds-ui/apps/*/module-federation.config.ts` if unused
- Modify: `mds-ui/README.md` (start instructions if serve flow changed)
- Optionally remove unused `@module-federation/enhanced` only if nothing else imports it (do not remove `@nx/module-federation` package if other tooling still needs it — leave dependency cleanup optional)

- [ ] **Step 1: Remove dead Nx MF config files** if no longer referenced; otherwise leave and note in README.

- [ ] **Step 2: Update `mds-ui/README.md`** with the exact start command that loads shell + remotes under classic MF.

- [ ] **Step 3: Re-run base jest + one development build of shell + remote-auth**

```bash
npx jest webpack.mf.base.spec.ts --config=jest.mf.config.ts
npx nx build remote-auth --configuration=development
npx nx build shell --configuration=development
```

- [ ] **Step 4: Commit**

```bash
git add mds-ui/README.md mds-ui/apps/*/module-federation.config.ts
git commit -m "docs(mds-ui): document classic MF serve and drop unused Nx MF configs"
```

---

## Self-review

1. Spec coverage: classic plugin, explicit shared, all apps, serve fallback, mat-table success — Tasks 1–4.
2. No placeholders in steps.
3. Ports match project.json; package list matches spec.
