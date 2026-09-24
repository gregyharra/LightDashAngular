# MDS UI — Classic Webpack ModuleFederationPlugin

**Date:** 2026-09-24  
**Status:** Approved for planning  
**Scope:** `mds-ui/` Module Federation webpack wiring + explicit shared singletons

## Problem

Company frontend standards use classic webpack Module Federation:

```js
const ModuleFederationPlugin = require('webpack/lib/container/ModuleFederationPlugin');
```

in a shared `webpack.base.js`, with an **explicit `shared` map** (Angular, CDK, Material, RxJS as singletons).

This repo instead uses Nx `@nx/module-federation/angular` `withModuleFederation()`, which wraps `@module-federation/enhanced/webpack` and **infers** `shared` from the project graph. That diverges from company standard and is a plausible cause of blank `mat-table` UIs when remotes load inside the shell (duplicate Material/CDK instances).

## Goals

1. Replace `withModuleFederation` with classic `webpack/lib/container/ModuleFederationPlugin`.
2. Centralize MF options + explicit `shared` singletons in a company-style base helper (analogous to `webpack.base.js`).
3. Keep Nx apps layout, ports, `@nx/angular:webpack-browser`, and shell `import('remote-*/Routes')` routing.
4. Restore `mat-table` rendering under the shell without plain-HTML table workarounds.

## Non-goals

- Keeping `@module-federation/enhanced` / `withModuleFederation` as the MF plugin path.
- Changing remote feature boundaries or route structure.
- Plain HTML table / `results-data-table` UI rewrites.
- Moving off Nx or abandoning `@nx/angular` executors.

## Decision (locked)

| Topic | Choice |
|-------|--------|
| Approach | **2** — classic `webpack/lib/container/ModuleFederationPlugin` |
| Plugin import | `require('webpack/lib/container/ModuleFederationPlugin')` (or TS-equivalent `import` of the same module) |
| Shared policy | Explicit map: Angular platform packages, `@angular/cdk`, `@angular/material`, `rxjs` / `rxjs/operators`, `@ngrx/store`, `@ngx-translate/core` |
| Share flags | `{ singleton: true, strictVersion: true, requiredVersion: '<from mds-ui/package.json>' }` |
| Entry filename | `remoteEntry.js` (company-style; replace Nx default `remoteEntry.mjs` unless proven incompatible) |
| Config layout | One base helper + thin per-app webpack configs; drop dependency on Nx `ModuleFederationConfig` / `withModuleFederation` |
| Dev serve | Keep multi-remote local ports; adapt shell serve so remotes still load (change executor/orchestration if `module-federation-dev-server` requires Nx MF helpers) |

## Architecture

```
mds-ui/
  webpack.mf.base.ts              # classic plugin factory + shared map + remote URL map
  apps/shell/webpack.config.ts
  apps/shell/webpack.prod.config.ts
  apps/remote-*/webpack.config.ts
  apps/remote-*/webpack.prod.config.ts
  apps/*/module-federation.config.ts   # optional: plain data only, or delete if inlined
```

### Base helper (`webpack.mf.base.ts`)

Exports:

1. `mfShared` — `Record<string, SharedConfig>` for the locked package set.
2. `createMfPlugin(options)` — instantiates classic `ModuleFederationPlugin` with:
   - `name`
   - `filename: 'remoteEntry.js'`
   - `exposes` and/or `remotes`
   - `shared: mfShared`
   - library settings required for Angular dynamic `import()` of remotes (document the working `library` / remotes string format in the plan once verified against webpack + Angular 20).
3. `devRemoteUrl(name, port)` — `http://localhost:<port>/remoteEntry.js` helpers for the shell remotes map.

### Per-app webpack

Each `webpack.config.ts` / `webpack.prod.config.ts` becomes a custom webpack transformer compatible with `@nx/angular:webpack-browser`:

```ts
import { createMfPlugin, mfShared, /* remotes or exposes */ } from '../../webpack.mf.base';

export default (config) => {
  config.plugins = config.plugins || [];
  config.plugins.push(
    createMfPlugin({
      name: 'remote-auth', // or shell
      exposes: { './Routes': 'apps/remote-auth/src/app/remote-entry/entry.routes.ts' },
      // shell: remotes: { 'remote-auth': 'remote_auth@http://localhost:4201/remoteEntry.js', ... }
    }),
  );
  // Ensure output.uniqueName / publicPath compatible with MF
  return config;
};
```

Remove all `import { withModuleFederation } from '@nx/module-federation/angular'`.

### Shell remotes (dev ports)

| Remote | Port |
|--------|------|
| remote-auth | 4201 |
| remote-projects | 4202 |
| remote-warehouses | 4203 |
| remote-tables | 4204 |
| remote-explorer | 4205 |
| remote-charts | 4206 |
| remote-dashboards | 4207 |
| remote-lineage | 4208 |
| remote-ai | 4209 |
| remote-export | 4210 |

Prod webpack configs override remote URLs (deployed origins) when known; until then, keep the same structure with placeholder comments matching current Nx prod stubs.

### Workspace libs

`@mds-ui/*` path aliases remain via Angular/TS/`tsconfig.base.json`. Classic MF does **not** get Nx’s automatic workspace-lib share/replacement plugin. Prefer bundling workspace libs into each remote/host as today via path aliases unless a share entry is later required.

### Dev server

If `@nx/angular:module-federation-dev-server` breaks without Nx MF config:

- Switch shell `serve` to `@nx/angular:dev-server` (or webpack-dev-server) and document starting remotes via `serve-static` / parallel `nx run-many`, **or**
- Keep remotes’ existing `serve-static` ports and point shell remotes at those URLs.

Success requires one documented `npm start` (or short script) that brings shell + remotes up.

## Success criteria

1. No app webpack config imports `@nx/module-federation/angular` `withModuleFederation`.
2. Classic `webpack/lib/container/ModuleFederationPlugin` is constructed from the base helper.
3. Explicit `shared` includes Material + CDK + Angular + RxJS as singletons.
4. `npm start` (or the documented start command) loads shell and remotes.
5. Users page `mat-table` shows loaded user rows.
6. No plain-HTML table workaround for this fix.

## Risks

| Risk | Mitigation |
|------|------------|
| ESM vs classic remoteEntry format breaks `import('remote-auth/Routes')` | Verify library/remotes format early on `remote-auth` + shell before rolling to all remotes |
| `module-federation-dev-server` depends on Nx MF | Fall back to explicit serve orchestration; document command |
| Name with hyphens (`remote-auth`) vs container global | Use webpack-supported naming (`library.name` / remotes string) proven in Angular MF docs |
| `strictVersion` build failures | Adjust `requiredVersion` per evidence; keep singleton |

## Relation to prior work

Supersedes the Approach A (Nx `additionalShared` only) draft in the same dated discussion. Complements `2026-09-16-mds-ui-nx-module-federation-architecture-design.md` for app layout; changes only the webpack MF plugin path and share policy.
