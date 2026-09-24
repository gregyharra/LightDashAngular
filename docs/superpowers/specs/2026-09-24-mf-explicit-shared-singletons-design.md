# MDS UI — Explicit Module Federation Shared Singletons

**Date:** 2026-09-24  
**Status:** Approved for planning  
**Scope:** `mds-ui/` Module Federation share config only

## Problem

Under the current Nx `@nx/module-federation` setup, each app uses `withModuleFederation()` with a thin `module-federation.config.ts` (`name` + `remotes` / `exposes` only). Shared npm packages are **inferred** from the Nx project graph plus a small Angular default list (`@angular/core`, `@angular/animations`, `@angular/common`).

Company frontend standards expect a classic webpack Module Federation style: an **explicit `shared` map** where Angular, Angular CDK, Angular Material, and RxJS are host/remote **singletons**.

Symptom that fits this gap: `mat-table` receives data but renders no rows/headers when a remote (e.g. `remote-auth` Users page) loads inside the shell — typical of duplicate Material/CDK instances across federated bundles.

## Goals

1. Keep Nx `withModuleFederation` / Enhanced webpack plugin / remotes wiring / ports unchanged.
2. Add one explicit shared-singleton policy for Angular, CDK, Material, RxJS (and selected state/i18n packages) applied identically on shell and every remote.
3. Restore correct `mat-table` (and other Material table) rendering under the shell without replacing Material with plain HTML tables.

## Non-goals

- Replacing `withModuleFederation` with hand-written `webpack.container.ModuleFederationPlugin`.
- Changing remote boundaries, exposes, or ports.
- UI workarounds (plain HTML tables / new shared table components).
- Changing Material versions or themes.

## Decision (locked)

| Topic | Choice |
|-------|--------|
| Depth | **Approach A** — keep `@nx/module-federation` + `withModuleFederation`; add explicit share config |
| Plugin | Remain on `@module-federation/enhanced/webpack` via Nx (not classic container plugin) |
| Config layout | One shared helper imported by every `apps/*/module-federation.config.ts` |
| Share mechanism | Both: `additionalShared` (ensure packages are always shared) **and** `shared` function (force singleton + strictVersion on those names when already graph-discovered) |
| Package set | `@angular/core`, `@angular/common`, `@angular/common/http`, `@angular/animations`, `@angular/platform-browser`, `@angular/platform-browser-dynamic`, `@angular/router`, `@angular/forms`, `@angular/cdk`, `@angular/material`, `rxjs`, `rxjs/operators`, `@ngrx/store`, `@ngx-translate/core` |
| Share flags | `{ singleton: true, strictVersion: true, requiredVersion: '<version from mds-ui/package.json dependencies>' }` |

## Architecture

```
mds-ui/
  module-federation.shared.ts          # single source of share policy
  apps/shell/module-federation.config.ts
  apps/remote-*/module-federation.config.ts
  apps/*/webpack.config.ts             # unchanged withModuleFederation(...)
```

### Helper responsibilities

`mds-ui/module-federation.shared.ts` exports values suitable for Nx `ModuleFederationConfig`:

- `mfAdditionalShared` — `AdditionalSharedConfig` entries for the locked package set, each with singleton + strictVersion + requiredVersion from `mds-ui/package.json`.
- `mfShared` — a `SharedFunction` that, when `libraryName` is in the locked package set (or a secondary entry under those scopes, e.g. `@angular/material/table`), returns the singleton config; otherwise returns `undefined` (leave Nx defaults alone).

Nx already expands many secondary entry points when sharing npm packages via `additionalShared` string names. The helper lists the locked primary names; `mfShared` also matches prefixes `@angular/material/`, `@angular/cdk/`, `@angular/common/` so secondary entries stay singletons.

### Wiring

Every existing `module-federation.config.ts` (shell + all `remote-*` apps) assigns:

```ts
import { mfAdditionalShared, mfShared } from '../../module-federation.shared';

const config: ModuleFederationConfig = {
  name: '...',
  // existing remotes / exposes unchanged
  shared: mfShared,
  additionalShared: mfAdditionalShared,
};
```

Relative import depth varies by app folder (`../..` from `apps/<name>/`).

Webpack files stay `export default withModuleFederation(config, { dts: false })`.

### Apps in scope

Shell and remotes that already have MF config:

- `shell`
- `remote-auth`, `remote-projects`, `remote-warehouses`, `remote-tables`
- `remote-explorer`, `remote-charts`, `remote-dashboards`
- `remote-lineage`, `remote-ai`, `remote-export`

## Success criteria

1. `npm start` (shell MF dev server) builds shell + remotes without share/version errors.
2. Users page (`remote-auth`) shows user rows in `mat-table` when data is loaded.
3. Chart/explorer/dashboard table views that use `mat-table` still render headers/rows when query data is present (smoke).
4. No new plain-HTML table workaround components introduced for this fix.

## Risks

| Risk | Mitigation |
|------|------------|
| `strictVersion: true` fails build on caret range mismatch | Use `requiredVersion` from installed root `package.json`; if Nx warns, set `requiredVersion: false` only for that package after evidence |
| Secondary Material entry points still duplicated | Add specific entry to `additionalShared` once identified |
| Helper path awkward for all apps | Place at `mds-ui/module-federation.shared.ts` and use relative imports, or a documented path alias |

## Relation to prior work

Supplements `2026-09-16-mds-ui-nx-module-federation-architecture-design.md` (Nx shell + remotes). Does not change lib boundaries or remote extraction. Explicitly rejects the temporary plain-table workaround previously tried for blank `mat-table`s.
