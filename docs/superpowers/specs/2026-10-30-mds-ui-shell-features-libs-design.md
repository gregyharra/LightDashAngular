# MDS UI — Shell + Feature Libs (No Remotes)

**Date:** 2026-10-30  
**Status:** Approved  
**Scope:** `mds-ui/` only  

## Problem

Module Federation remotes (`apps/remote-*`) add multi-process serve, webpack MF shared-singleton complexity, and host/remote boundaries that only pay off when remotes are published for other company hosts. This product does not re-import remotes elsewhere. Feature code should live in libraries; the only application is the shell.

Historical MF architecture docs (`2026-09-16-mds-ui-nx-module-federation-architecture-design.md` and related plans) remain as archive for how we got here; **this spec supersedes the remotes end-state** for the product shape.

## Goals

1. Single app: `apps/shell` owns routing, layout, styles, i18n asset hosting, and app providers.
2. Domain UI/logic in `libs/features/{name}` with import `@mds-ui/features/{name}`.
3. Strict layering: **no feature → feature** imports; cross-cutting code in `libs/core` / `libs/shared` / `libs/models`.
4. ngx-translate v18: root `provideTranslateService` + per-feature `provideChildTranslateService` with catalogs under shell assets.
5. App remains shippable after each migration phase (serve/build/smoke).

## Non-goals

- Publishing remotes or Module Federation for other hosts.
- Domain-scoped Nx tags beyond `type:*`.
- Rewriting facade/store patterns beyond moves needed for boundaries.

## Locked decisions

| Topic | Choice |
|-------|--------|
| Apps | Only `apps/shell`; delete all `apps/remote-*` |
| Features | `libs/features/{name}` (`type:feature`), alias `@mds-ui/features/{name}` |
| Shared layers | Top-level `libs/models`, `libs/core`, `libs/shared` |
| Feature → feature | Forbidden (existing ESLint `depConstraints`) |
| Cross-cutting chart-query | Move into `libs/core`; update imports to `@mds-ui/core` |
| Shared explorer UI | Deduplicate into `libs/shared` |
| Old `libs/feature-*` | Absorb into matching `libs/features/{name}` (or core for chart-query) |
| i18n files | Root: `apps/shell/src/assets/i18n/{lang}.json`; feature: `apps/shell/src/assets/i18n/{feature}/{lang}.json` |
| Migration order | Collapse MF → move cross-cutting → peel features → split i18n → cleanup |

## Target workspace shape

```
mds-ui/
  apps/
    shell/                 # type:app — host, routing, layout, styles, i18n assets
  libs/
    models/                # type:models
    core/                  # type:core — guards, api, LanguageService, chart-query, …
    shared/                # type:shared — pipes, directives, reusable UI
    features/
      auth/
      projects/
      warehouses/
      tables/
      explorer/
      charts/
      dashboards/
      lineage/
      ai/
      export/
```

### Boundary rules (unchanged severity)

| sourceTag | onlyDependOnLibsWithTags |
|-----------|--------------------------|
| type:models | [] |
| type:core | [type:models] |
| type:shared | [type:models, type:core] |
| type:feature | [type:models, type:core, type:shared] |
| type:app | [type:models, type:core, type:shared, type:feature] |

Shell composes cross-feature UX in `app.routes.ts` (e.g. settings children load warehouses and users routes). Features never import other features.

## Shell and features

### Shell owns

- `app.config`, `app.routes`, `app.component`, layout chrome
- Global styles (Material + Tailwind), i18n JSON assets
- Root translate providers and `LanguageService` init
- Lazy composition of each feature’s exported routes

### Each feature lib owns

- Feature pages, facades, feature-local NgRx store
- Exported route constants (and settings shell where applicable)
- Route-level `providers` including `provideChildTranslateService` for that feature’s catalog

### Feature inventory

| Lib | Source (from remotes / old feature libs) |
|-----|------------------------------------------|
| features/auth | remote-auth |
| features/projects | remote-projects + feature-projects |
| features/warehouses | remote-warehouses + feature-warehouses |
| features/tables | remote-tables |
| features/explorer | remote-explorer |
| features/charts | remote-charts |
| features/dashboards | remote-dashboards |
| features/lineage | remote-lineage |
| features/ai | remote-ai + feature-ai |
| features/export | remote-export + feature-export |

## i18n (ngx-translate v18)

- Root: `provideTranslateService({ loader: provideTranslateHttpLoader(...), fallbackLang, lang })` with plugins nested in the config object; initialize language via `provideAppInitializer` + `LanguageService`.
- Root catalog: shared keys only (`common`, `nav`, `sidebar`, and other truly global namespaces).
- Per feature route tree: `provideChildTranslateService({ loader: provideTranslateHttpLoader({ prefix: '/assets/i18n/{feature}/', suffix: '.json' }) })`.
- Child lookups resolve local keys first, then walk the parent chain to root.
- Single app language: children delegate `currentLang` / `fallbackLang` to root; `LanguageService` calls root `TranslateService.use`.

Namespaces today in the monolithic catalogs map to feature folders (e.g. `auth` → `i18n/auth/`, `projects` → `i18n/projects/`). Shared filter/query keys go to root or the owning feature as used by the UI.

## Migration sequence

1. **Collapse MF** — shell uses normal webpack/dev-server; path aliases still point at remote folders temporarily; one process on 4200.
2. **Cross-cutting** — chart-query → core; dedupe shared explorer panels → shared.
3. **Peel features** — auth → projects → warehouses → tables → explorer → charts → dashboards → lineage → ai → export; delete each remote when done.
4. **i18n split** — root + child catalogs and `provideChildTranslateService` on feature routes.
5. **Cleanup** — remove MF packages and docs for multi-remote serve; verify lint/test/build/e2e.

## Success criteria

1. No `apps/remote-*`; no Module Federation plugin / MF serve executor.
2. Domain code under `libs/features/*`; shell only imports libs.
3. ESLint fails on feature → feature and wrong-layer deps.
4. Root + child translate providers per ngx-translate v18 docs; en/fr switch works without flicker.
5. `nx serve shell` / `nx build shell` and smoke path login → projects → one workspace page pass.

## Risks

| Risk | Mitigation |
|------|------------|
| Feature needs another feature’s UI | Extract to `shared` or compose in shell routes |
| chart-query in core grows large | Accept for now; split later only if needed |
| Child translate DI misses pipe context | Provide child service on the same route `providers` as the feature pages |
| Shell initial budget after single graph | Raise budgets in shell `project.json` if needed |
