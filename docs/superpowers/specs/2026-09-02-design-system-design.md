# Data Platform Design System (mds-ui)

**Date:** 2026-09-02  
**Status:** Draft — awaiting user review before implementation plan  
**Scope:** `mds-ui` only (plus i18n JSON if new chrome copy is needed)  
**Approach:** Identity-first kit — tokens + Material wrappers + shell/page patterns (Approach 1)

## Problem

Visual and interaction patterns in `mds-ui` are scattered: CSS variables in `_lightdash-theme.scss`, layout rules in `_page-layout.scss` / `_navbar.scss`, feature widgets in `shared/`, list helpers in `ui/`, and many screens still style Angular Material ad hoc. Changing brand or chrome requires hunting through many files. The Data Platform identity restyle needs reusable pieces so one change can ripple across the app.

## Goals

1. Establish a **layered design system** under `mds-ui/src/app/design-system/` with an `Ld*` public API.
2. Make **tokens the single source of truth** for brand color, spacing, radius, type, and shell metrics — UI code uses semantic CSS variables, not hard-coded hex.
3. Wrap Angular Material behind **thin primitives** so features prefer `LdButton` / `LdIconButton` / etc. over raw `mat-*` for chrome we control.
4. Extract **shell + page scaffolding patterns** used by the Data Platform identity work so identity screens consume the system rather than one-off markup.
5. Ship **incrementally, identity-driven**: formalize what identity needs first; migrate other surfaces when touched.

## Non-goals (v1)

- Storybook / external component catalog.
- Dark-mode theme toggle (dark sidenav is a fixed pattern, not a global theme).
- Full form-control primitive set (select, datepicker, full dialog system).
- Data-surface patterns (content list rows, filter chips bar) — follow-up wave; leave `ui/` as-is for now.
- Rewriting every feature screen to `Ld*` in v1.
- Moving `shared/` feature widgets (SQL highlight, run-query, API error banner) into the design system.
- Separate npm / Angular library package.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Scope depth | Tokens + primitives + higher-level patterns (not tokens-only) |
| Material strategy | Keep Material as base; wrap common controls in `Ld*` |
| Rollout | Identity-driven first release |
| V1 pattern groups | Shell chrome + page scaffolding; data surfaces later |
| Location | `mds-ui/src/app/design-system/` with `Ld*` class names |
| DOM selectors | `ld-*` (e.g. `ld-button`, `ld-page-header`) — design-system namespace; rest of app keeps `app-*` |
| Architecture approach | Identity-first kit (tokens → theme bridge → needed primitives → patterns → wire identity) |
| Import path | Relative (or existing app path aliases) via public barrel `design-system/index.ts` only; no deep imports from features |
| `shared/` / `ui/` | Remain for feature widgets / list helpers until a later migration wave |
| Catalog | Living catalog = identity screens + unit tests (no Storybook in v1) |

## Architecture

```text
mds-ui/src/styles/_lightdash-theme.scss     ← token source of truth (CSS variables)
mds-ui/src/styles/ (Material theme bridge) ← map tokens → Mat theme / overrides

mds-ui/src/app/design-system/
  tokens/          # optional SCSS helpers / token docs comments; no duplicate hex
  primitives/      # LdButton, LdIconButton, LdSearchField, LdBrandMark, …
  patterns/        # LdAppTopbar, LdProjectSidenav, LdPageFrame, …
  index.ts         # public barrel

layout/ + features/
  └── import from design-system barrel; own routing/state/services
```

**Layers (bottom → top)**

1. **Tokens** — Extend `_lightdash-theme.scss` with a clear semantic set (`--ld-color-brand`, `--ld-color-fg`, `--ld-space-*`, `--ld-radius-*`, `--ld-font-*`, shell sizes). Keep raw palette (`--ld-navy`, `--ld-gray-*`) as the palette layer; prefer semantic names in new UI.
2. **Material theme bridge** — Map tokens into Angular Material (primary/accent, density, radius) so leftover raw `mat-*` stays on-brand during migration.
3. **Primitives** — Standalone Angular components wrapping Material; stable inputs (`variant`, `size`, `disabled`, `loading`, `ariaLabel`); internals may use `mat-button` / `mat-icon-button`.
4. **Patterns** — Compose primitives + layout tokens for shell and page chrome; expose slots (`ng-content`) and simple inputs.
5. **App layout / features** — Orchestrate services and routing; delegate presentation to `Ld*` patterns.

**Rules of engagement**

- New identity UI imports from the design-system barrel, not copied SCSS islands.
- Design-system SCSS references semantic CSS variables only — no brand hex in component styles.
- Cross-browser (Chromium + Firefox); no horizontal page scroll; `min-width: 0` on flex children; action labels `white-space: nowrap` + `flex-shrink: 0` on buttons.

## V1 components

### Primitives

| Component | Role |
|-----------|------|
| `LdButton` | text / filled / outlined; primary + neutral; optional leading icon |
| `LdIconButton` | toolbar / circular actions (AI, help, settings, notifications) |
| `LdSearchField` | pill search matching Data Platform topbar |
| `LdBrandMark` | SVG mark + optional wordmark (i18n-driven labels stay with parent/link) |

Optional thin menu wrappers only if needed to stabilize the user-menu pattern; otherwise Mat menu may remain behind a pattern component.

**Deferred primitives:** full form-field, select, dialog chrome, tabs, snackbar — unless a v1 pattern absolutely requires a wrapper.

### Patterns

| Component | Role |
|-----------|------|
| `LdAppTopbar` | Three-column chrome: brand \| center slot \| actions slot |
| `LdProjectSidenav` | Dark project browse nav (stabilize / extract current `project-browse-nav` presentation) |
| `LdPageFrame` | Page width, padding, overflow / `min-width: 0` contract |
| `LdPageHeader` | Title, optional subtitle, trailing action cluster |
| `LdActionCluster` | Primary + secondary actions with nowrap / shrink rules |
| `LdEmptyState` | Title, short body, optional CTA |

**Ownership split**

- Design system: presentation, slots, visual variants, a11y passthrough on primitives.
- Layout/features: `ActiveProjectService`, search service, AI panel, router links, permissions, i18n keys for product copy.

Existing `app-shell` / navbar / `project-browse-nav` become thin orchestrators around patterns, or move pure UI into `patterns/` when they have no domain logic.

## Integration & migration

### Waves (v1)

1. **Tokens + Material theme bridge** — semantic vars; map into Mat theme.
2. **Primitives** — only those required by shell/page patterns.
3. **Patterns** — implement; wire identity shell (topbar, sidenav) through them.
4. **Page adoption** — `LdPageFrame` / `LdPageHeader` / `LdEmptyState` / `LdActionCluster` on identity-touched pages (hub, home, explorer chrome, dashboard chrome as covered by the identity plan).
5. **Leave alone** — `shared/`, `ui/`, and untouched feature screens until later waves.

### Relationship to identity plan

The Data Platform identity plan (`docs/superpowers/plans/2026-09-02-data-platform-identity.md`) continues as the visual/product checklist. **Identity UI work should land through this design system** (tokens + `Ld*` patterns) rather than one-off shell SCSS. Where the identity plan and this spec conflict on structure, this spec wins for component boundaries; the mockups remain the visual reference.

### Compatibility

- No route or product behavior removals.
- Do not commit `.tmp/` mockups.
- Work under `mds-ui/` (and i18n JSON if needed).

## Testing & quality bar

**Primitives:** Unit tests for public API — variants apply expected classes/bindings; `disabled` / `loading`; `aria-label` passthrough on icon buttons.

**Patterns:** Unit tests for composition contracts — header shows title and projects actions; topbar renders brand + slots; empty state CTA only when provided.

**Shell wiring:** Keep/extend existing `app-shell`, navbar, and `project-browse-nav` specs so identity behavior (home link, settings entry, project-active search) still passes after extraction.

**Manual smoke:** Chromium + Firefox on shell + at least one page using `LdPageFrame` / `LdPageHeader` — no horizontal page scroll; action labels stay single-line.

**Errors:** Design-system components do not own API error handling. Parents pass copy into empty states / banners. `api-error-banner` stays in `shared/` for v1.

## Follow-up waves (explicitly later)

1. Data surfaces — promote/replace `ui/content-list-*` with `Ld*` list/filter patterns.
2. Broader Material wrapping — form fields, dialogs, tabs as features adopt them.
3. Gradual migration of remaining screens off raw `mat-*` for covered primitives.
4. Optional Storybook / visual catalog if the team wants an isolated browser for components.

## Success criteria

- Changing a semantic brand token (e.g. `--ld-color-brand`) updates shell chrome and `Ld*` consumers without hunting hex values in feature SCSS.
- Identity topbar and project sidenav are implemented as (or strictly composed from) design-system patterns.
- At least one identity page uses `LdPageFrame` + `LdPageHeader` (+ empty state where applicable).
- Features import design-system pieces only via the public barrel.
- Existing shell/nav unit tests pass; new primitive/pattern tests cover the public contracts above.
