# MDS UI — Nx Module Federation Architecture Alignment

**Date:** 2026-09-16  
**Status:** Approved for planning  
**Scope:** `mds-ui/` only (repo root stays a multi-package workspace)

## Problem

Company frontend standards require an Nx monorepo with:

- `apps/` + `libs/` layout
- Tagged layers: `type:models` → `type:core` → `type:shared` → `type:feature` → `type:app`
- `@nx/enforce-module-boundaries` at error with `enforceBuildableLibDependency: true`
- Routing at application (shell) level
- Small `core` / `shared`; features not placed in shared
- Module Federation host + remotes
- Store + facade pattern inside features
- Tailwind in the app styles pipeline (alongside existing UI libraries)

Today `mds-ui` is a single Angular CLI app with folders (`core`, `features`, `shared`, `layout`, `ui`) that only partially match that model. Models live under `core/models`, there is no Nx or module-boundary enforcement, and there are no Module Federation remotes.

## Goals

1. Convert `mds-ui` into an Nx workspace whose end state matches the company standard (shell + fine-grained remotes + global libs).
2. Keep the product **shippable after every migration step** (green lint/tests/serve; smoke paths work).
3. Standardize **NgRx store + facade** for every feature remote (components do not use `Store` directly).
4. Add **Tailwind beside Angular Material** in the shell styles pipeline.
5. Enforce dependency direction with company `depConstraints`.

## Non-goals

- Domain / scoped libs (`scope1`) in this pass — global libs only.
- Moving `mds-backend`, `mds-transform`, or `mds-worker` into Nx.
- Replacing Material with a Tailwind-only component system.
- Publishing remotes for consumption by other company hosts (follow-up).
- Perfect DDD rewrite of every service on day one — wrap/move behind facades as remotes are extracted.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Depth | Full target: Nx + libs + Module Federation remotes |
| Remotes | One host shell + one remote per major feature area |
| Nx root | `mds-ui/` only |
| Delivery | Aggressive path to end state; always shippable (host-first vertical slices) |
| State | Full store + facade per feature remote |
| Lib scopes | Global `models` / `core` / `shared` only |
| Styling | Tailwind **alongside** Material |

## Target workspace shape

```
mds-ui/
  apps/
    shell/                 # type:app — host, routing, layout, styles, i18n, MF config
    remote-auth/
    remote-projects/       # projects browse + settings admin surfaces
    remote-warehouses/
    remote-tables/
    remote-explorer/
    remote-charts/
    remote-dashboards/
    remote-lineage/
    remote-ai/
    remote-export/
  libs/
    models/                # type:models — types, interfaces, consts, enums (no deps)
    core/                  # type:core — guards, interceptors, api, utils, validators,
                           #            repos/mappers, common store/facades
    shared/                # type:shared — pipes, directives, reusable UI
    feature-*/             # type:feature — optional shared feature logic used by apps
                           #            (never tagged type:shared)
```

### Mapping from current tree

| Today | Target |
|-------|--------|
| `src/app/core/models` | `libs/models` |
| `src/app/core/*` (api, guards, interceptors, services, common store) | `libs/core` |
| `src/app/shared` + `src/app/ui` | `libs/shared` |
| `src/app/layout` | Mostly `apps/shell` (+ tiny pieces in `libs/shared` only if reused across remotes) |
| `src/app/features/*` | `apps/remote-*` (+ optional `libs/feature-*` when logic must be shared without remote→remote imports) |
| `app.routes.ts` / `app.config.ts` | `apps/shell` |

### Boundary rules

Company `depConstraints` (severity):

| `sourceTag` | `onlyDependOnLibsWithTags` |
|-------------|----------------------------|
| `type:models` | `[]` |
| `type:core` | `["type:models"]` |
| `type:shared` | `["type:models", "type:core"]` |
| `type:feature` | `["type:models", "type:core", "type:shared"]` |
| `type:app` | `["type:models", "type:core", "type:shared", "type:feature"]` |

Additional rules:

- Remotes (`type:app`) must **not** import other remotes.
- Do **not** tag feature libraries as `type:shared` to share them across features.
- Keep `libs/core` and `libs/shared` small; prefer feature-local code inside the remote.
- Routing stays in the shell; remotes export entry + routes for the shell to compose.
- `enforceBuildableLibDependency: true`.

## Shell and remotes

### Shell owns

- `app.config`, `app.routes`, `app.component`
- Layout chrome (app-shell, navbar, sidebars)
- Global styles: Material theme + Tailwind entry (`styles/`, `tailwind.config`)
- i18n assets
- Module Federation host config (remotes map)
- Lazy composition of each remote’s routes / entry

### Each remote owns

- `*-entry.component` (federation entry)
- Feature pages/components (nested as needed)
- Feature-local `core/` (store, services, local guards)
- Feature-local `models/` (types used only here)
- Feature-local `shared/` (UI used only inside that remote)
- A **facade per major UI surface** (page / important nested panel)

### Remote inventory (v1)

| Remote | Current source |
|--------|----------------|
| `remote-auth` | `features/auth` |
| `remote-projects` | `features/projects` + `features/settings` (+ thin `spaces` if still present) |
| `remote-warehouses` | `features/warehouses` |
| `remote-tables` | `features/tables` |
| `remote-explorer` | `features/explorer` |
| `remote-charts` | `features/charts` |
| `remote-dashboards` | `features/dashboards` |
| `remote-lineage` | `features/lineage` |
| `remote-ai` | `features/ai` |
| `remote-export` | `features/export` |

Cross-remote needs go through `libs/models`, `libs/core`, `libs/shared`, or a small `libs/feature-*`. Prefer extracting a shared contract/UI over remote→remote imports. Export dialogs may stay in `remote-export` with a public entry the shell (or a feature lib) opens — not by importing another remote’s internals.

## Store and facade pattern

NgRx is already in use (`chart-query` and several `Store` injections). Standardize on NgRx for every remote.

### Feature remote layout

```
apps/remote-explorer/src/
  lib/
    explorer-entry.component.ts
    explorer.routes.ts          # exported; registered by shell
    page/                       # thin components
    core/
      store/                    # actions, feature/reducer, effects, selectors
      services/                 # API adapters / repositories
      facades/                  # one facade per major UI surface
    models/
    shared/
```

### Rules

- Components talk to **facades only** (no direct `Store` / effects in component TS except temporary mid-migration exceptions that must be cleaned before the remote is “done”).
- Facades expose signals or observables plus intent methods (`load()`, `runQuery()`, …).
- Feature state lives in the remote.
- Truly cross-app state (auth session, active project) lives in `libs/core` with common facades.
- Shared query state such as `chart-query`: prefer a small `libs/feature-chart-query` tagged `type:feature` over bloating `libs/core`, if only explorer/charts/dashboards need it.
- Facade unit tests use a mock store or `provideStore`; component tests mock the facade.

## Tailwind and Material

- Add Tailwind in the **shell** (`tailwind.config`, CSS entry under `apps/shell/src/styles`).
- Material remains the component library; Tailwind covers layout/spacing/utilities and future design-system tokens.
- Remotes must not require a second global CSS bootstrap; they consume shell-provided globals at runtime. Remote-local SCSS stays encapsulated.
- Design-system work already specified elsewhere may land in shell styles over time; this initiative only establishes the Tailwind pipeline beside Material.

## Migration sequence (always shippable)

Approach: **host-first vertical slices**. Each step ends with boundary lint + unit tests + composed serve green. Prefer short PRs per step.

| Step | Work | Shippable meaning |
|------|------|-------------------|
| 0 | Convert `mds-ui` → Nx; current app becomes `apps/shell` (single bundle). Add boundary ESLint + tags. Add Tailwind beside Material. | Same UX via shell |
| 1 | Extract `libs/models` | Externally unchanged |
| 2 | Extract `libs/core` | Externally unchanged |
| 3 | Extract `libs/shared` from `shared/` + `ui/` | Externally unchanged |
| 4 | Peel remotes in order: auth → projects (+ settings) → warehouses → tables → explorer → charts → dashboards → lineage → ai → export. Per remote: move → store/facades → MF entry → shell loads remote. | Full app works; extracted area via federation |
| 5 | Remove leftover old feature paths; tighten boundaries; CI builds all remotes; document scripts | Done shape |

### Mid-flight invariants

- Shell routes remain the source of truth.
- Before a remote is federated, its code may temporarily live as a `type:feature` lib imported by the shell, then promote to `apps/remote-*`.
- No remote→remote imports; if blocked, extract to `libs/*` first.
- Never mark feature code `type:shared` to share it.
- Playwright smoke (login → projects → one workspace page) runs after each remote peel.
- Local `package.json` stays under `mds-ui/`; do not add UI deps to the repo root `package.json`.

## Tooling and CI

- Scripts (illustrative): `nx serve shell`, `nx build shell` (and remotes), `nx test <project>`, Playwright against the composed app.
- CI: build shell + all remotes; fail on module-boundary violations.
- Tags on every `project.json`: `type:models | core | shared | feature | app`.

## Success criteria

1. `mds-ui` is an Nx workspace with shell + listed remotes + global `models` / `core` / `shared`.
2. Module boundaries match company rules; CI fails on violations.
3. Routing only in the shell; remotes expose entry + routes.
4. Every feature remote uses store + facade; components do not talk to `Store` directly.
5. Material + Tailwind both live in the shell styles pipeline.
6. App remains usable after each migration step; final smoke paths pass.

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Long-lived dual layout (old folders + new libs) | Strict peel order; delete old paths as soon as a remote is done |
| Circular or remote→remote temptation | Boundary lint at error; extract shared contracts early |
| `core` / `shared` bloat | Review each extract; prefer feature-local folders |
| MF local serve complexity | Document Nx serve targets; keep smoke e2e on composed app |
| Facade migration churn | Thin facades wrapping existing services first; deepen stores per remote |

## Related specs

- `2026-09-02-design-system-design.md` — identity kit under `src/app/design-system/`. During this migration, that kit moves with shell/shared (likely `apps/shell` styles + `libs/shared` or a dedicated `type:shared` lib). Update paths in that spec when the extract lands; no change to its product goals.

## Open follow-ups (not blocking)

- Optional domain scopes (`workspace`, `admin`, …) after global libs stabilize.
- Consuming remotes from other company hosts.
- Bundle analysis (`source-map-explorer` with production + `sourceMaps` + `namedChunks`) as a recurring hygiene task once remotes exist.
