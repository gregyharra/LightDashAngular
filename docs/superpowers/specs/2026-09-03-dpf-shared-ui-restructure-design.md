# Data Platform UI kit restructure (`shared/ui`)

**Date:** 2026-09-03  
**Status:** Approved — implementation plan in `docs/superpowers/plans/2026-09-03-dpf-shared-ui-restructure.md`  
**Scope:** `mds-ui` only  
**Supersedes (partially):** location + naming decisions in `2026-09-02-design-system-design.md` (tokens + Material-wrapper strategy remain)

## Problem

The in-app design kit lives under `mds-ui/src/app/design-system/` with nested `primitives/` / `patterns/` and an `Ld*` / `ld-*` public API. Company Angular apps (e.g. GoNetZero) instead keep a flat UI catalog under app `shared/`, separate from feature glue. Aligning folder shape and naming makes the kit recognizable to the team without adopting an external design-system package.

## Goals

1. Relocate the UI kit to `mds-ui/src/app/shared/ui/` with two sibling flat roots: `components/` and `patterns/`.
2. Rename the public API from `Ld*` / `ld-*` to `Dpf*` / `dpf-*` (Data Platform).
3. Keep a single public barrel; features must not deep-import kit internals.
4. Leave existing feature widgets under `shared/*` (siblings of `ui/`) unchanged in this pass.
5. Complete the move + rename in one pass (no long-lived dual API / shims).

## Non-goals

- Extracting a publishable npm / Nx library (MyCreditApp-style monorepo).
- Storybook / MDX catalog.
- Renaming CSS tokens `--ld-*` → `--dpf-*` (optional later pass).
- Moving feature `shared/*` widgets into `shared/ui`.
- Consuming an external company design-system package.
- Behavior/visual redesign of components (structure + names only).

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Company alignment model | GoNetZero-style: in-app kit + classic `shared/` for feature glue |
| Kit home | `mds-ui/src/app/shared/ui/` |
| Internal split | `components/` (atoms) + `patterns/` (composed chrome), each flat |
| Feature widgets | Stay as `shared/<widget>/` siblings of `ui/` |
| Public API prefix | `Dpf*` classes, `dpf-*` selectors / BEM hosts |
| Tokens | Keep `--ld-*` in `_lightdash-theme.scss` for this pass |
| Migration | Single pass: move + rename + update consumers; delete `design-system/` |
| Compatibility shims | None |
| Leftover `app/ui/` | Delete or fold unused `content-list-filter-bar` in the same pass |

## Architecture

```text
mds-ui/src/styles/_lightdash-theme.scss   ← tokens (--ld-*) unchanged this pass

mds-ui/src/app/shared/
  ui/
    components/
      button/
      icon-button/
      brand-mark/
      search-field/
    patterns/
      action-cluster/
      app-topbar/
      page-header/
      page-frame/
      empty-state/
      content-list-filter-chips/
      content-list-column-header/
      project-sidenav/
    utils/
      content-list-filter.utils.ts
    index.ts                              ← public barrel only
  sql-highlight/                          ← feature shared (unchanged)
  confirm-dialog/                         ← unchanged
  …

mds-ui/src/app/design-system/             ← removed after migration
mds-ui/src/app/ui/                        ← removed after leftover cleanup
```

**Layers (unchanged conceptually)**

1. Tokens (`--ld-*`) → Material theme bridge  
2. `shared/ui/components` — Material wrappers (`DpfButton`, …)  
3. `shared/ui/patterns` — shell/page chrome composed from components  
4. Features / layout — import barrel only; own routing/state  

**Import rule**

```ts
import { DpfButtonComponent, DpfPageHeaderComponent } from '../../shared/ui';
```

Relative paths (or existing path aliases) that resolve to `shared/ui/index.ts` only. No deep imports into `components/` or `patterns/`.

## Naming map

| Old | New |
|-----|-----|
| `LdButtonComponent` / `<ld-button>` | `DpfButtonComponent` / `<dpf-button>` |
| `LdIconButtonComponent` / `<ld-icon-button>` | `DpfIconButtonComponent` / `<dpf-icon-button>` |
| `LdBrandMarkComponent` / `<ld-brand-mark>` | `DpfBrandMarkComponent` / `<dpf-brand-mark>` |
| `LdSearchFieldComponent` / `<ld-search-field>` | `DpfSearchFieldComponent` / `<dpf-search-field>` |
| `LdActionClusterComponent` / `<ld-action-cluster>` | `DpfActionClusterComponent` / `<dpf-action-cluster>` |
| `LdAppTopbarComponent` / `<ld-app-topbar>` | `DpfAppTopbarComponent` / `<dpf-app-topbar>` |
| `LdPageHeaderComponent` / `<ld-page-header>` | `DpfPageHeaderComponent` / `<dpf-page-header>` |
| `LdPageFrameComponent` / `<ld-page-frame>` | `DpfPageFrameComponent` / `<dpf-page-frame>` |
| `LdEmptyStateComponent` / `<ld-empty-state>` | `DpfEmptyStateComponent` / `<dpf-empty-state>` |
| `LdContentListFilterChipsComponent` / `<ld-content-list-filter-chips>` | `DpfContentListFilterChipsComponent` / `<dpf-content-list-filter-chips>` |
| `LdContentListColumnHeaderComponent` / `<ld-content-list-column-header>` | `DpfContentListColumnHeaderComponent` / `<dpf-content-list-column-header>` |
| `LdProjectSidenavComponent` / `<ld-project-sidenav>` | `DpfProjectSidenavComponent` / `<dpf-project-sidenav>` |
| `LdProjectSidenavItem` | `DpfProjectSidenavItem` |
| Host/BEM `ld-button`, `ld-button--filled`, … | `dpf-button`, `dpf-button--filled`, … |

File names drop the `ld-` prefix to match folders, e.g. `button.component.ts` under `components/button/`.

Exported types used outside the kit (e.g. column filter types) keep their semantic names unless they currently carry an `Ld` prefix — those get `Dpf` or stay unprefixed if already generic (`ColumnFilterType`).

## Migration plan (implementation outline)

1. Create `shared/ui/` tree; move each kit unit into the flat folder; rename symbols, selectors, host classes, and file names.
2. Rewrite `shared/ui/index.ts` barrel to export `Dpf*` APIs and utils.
3. Update all feature/layout imports and templates (~20+ consumers today) plus unit specs.
4. Delete `mds-ui/src/app/design-system/`.
5. Resolve `mds-ui/src/app/ui/content-list-filter-bar`: if unused after kit patterns exist, delete the folder; if still referenced, migrate callers to the pattern or keep temporarily under `shared/ui/patterns` only if it is true kit UI.
6. Run unit tests for moved components; smoke-check app shell (topbar, sidenav, page header, primary buttons).

## Testing

- Existing component specs move with their units and assert `dpf-*` selectors / class names where they currently assert `ld-*`.
- No new visual regression suite required for a rename/move.
- Manual smoke: login → projects hub → one list page header/actions → project browse nav.

## Risks

| Risk | Mitigation |
|------|------------|
| Missed `ld-` string in templates/styles | Repo-wide search for `ld-button`, `LdButton`, `design-system` before merge |
| Token / BEM confusion (`--ld-*` vs `dpf-*` classes) | Document in barrel README comment; token rename is explicit follow-up |
| Deep imports reintroduced | Enforce barrel-only via review; optional lint later |

## Follow-ups (not this change)

- Optional `--ld-*` → `--dpf-*` token rename.
- Storybook for `shared/ui`.
- Gradually nest or regroup feature `shared/*` widgets if desired (services/pipes style folders).
- Extract publishable library only if multiple apps need the same kit.
