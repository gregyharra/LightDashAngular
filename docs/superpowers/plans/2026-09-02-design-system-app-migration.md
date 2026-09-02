# Design System App Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do **not** ask the user to choose Inline vs Subagent-Driven.

**Goal:** Migrate remaining `mds-ui` routed pages and major layout chrome onto the Data Platform design system so page scaffolding and common controls use `Ld*` / tokens via the public barrel.

**Architecture:** Keep domain logic in feature components. Page chrome (frame, header, empty, primary/secondary actions, icon actions where the circular toolbar primitive fits) consumes `Ld*` from `mds-ui/src/app/design-system/index.ts`. Promote shared content-list presentation into design-system patterns so list/filter UI is not a parallel lookalike under `ui/`. Dense Material tables, form fields, dialogs, and graph/workspace internals stay Material until a later wave — replace only chrome buttons/headers/empty states where an `Ld*` exists.

**Tech Stack:** Angular 20 standalone, Angular Material 20, SCSS tokens, Jasmine/Karma, ngx-translate.

## Global Constraints

- Branch: `feat/design-system` (already exists; work in place unless a worktree is already active).
- Work under `mds-ui/` (plus i18n JSON only if copy keys are required). Do **not** commit `.tmp/`.
- Public imports only via `mds-ui/src/app/design-system` barrel (`../../../design-system` or equivalent). No deep imports into `primitives/` / `patterns/`.
- Selectors: `ld-*` for design-system; keep `app-*` for layout/features.
- Design-system SCSS: semantic CSS variables only (`--ld-color-*`, `--ld-space-*`, etc.) — no brand hex in DS component styles. In **touched** feature SCSS, replace brand palette hex / `var(--ld-navy)` brand usages with semantic tokens (`--ld-color-brand`, `--ld-color-fg`, …) where straightforward; leave non-brand status colors (error reds) alone unless a semantic error token already exists.
- Prefer existing primitives/patterns: `LdButton`, `LdIconButton`, `LdBrandMark`, `LdSearchField`, `LdPageFrame`, `LdPageHeader`, `LdActionCluster`, `LdEmptyState`, `LdAppTopbar`, `LdProjectSidenav`.
- `LdButton` is a `<button>` only — do not invent routerLink on the primitive. Replace `<a mat-flat-button routerLink=…>` with `ld-button` + click/`Router.navigate`, or keep a plain routerLink styled via parent if navigation-as-anchor is required for a11y — prefer click navigate matching projects hub.
- `LdIconButton` is the **circular toolbar** control. Use it for page/toolbar chrome. Dense in-table/in-card icon actions may keep `mat-icon-button` when the circular 40px chrome style would break density.
- Chromium + Firefox; no horizontal page scroll; `min-width: 0` on flex children; action labels `white-space: nowrap` + `flex-shrink: 0` on buttons.
- Do not rewrite unrelated business logic, routes, or backend.
- Do not add Storybook.
- TDD for **new** design-system components/patterns. For page migrations: update/break-fix existing page specs; add assertions for `ld-page-frame` / `ld-page-header` / `ld-empty-state` / `ld-button` where those pages already have specs.
- Commit after each task on `feat/design-system`. Do not push unless asked.
- Do **not** commit the stray `mds-ui/tsconfig.json` change that excludes `*.spec.ts` — revert it if present in the working tree before committing unrelated work.
- Spec: `docs/superpowers/specs/2026-09-02-design-system-design.md`. Reference migration: `projects-page` (already on `LdPageFrame` / `LdPageHeader` / `LdEmptyState` / `LdButton`).

## File structure (target additions)

```text
mds-ui/src/app/design-system/
  index.ts                          # export new list patterns + filter utils types
  patterns/
    ld-content-list-filter-chips/
    ld-content-list-column-header/
  utils/
    content-list-filter.utils.ts    # moved from ui/ (pure logic)
```

`ui/content-list-filter-bar/` is unused by features — leave in place or delete only if task explicitly confirms zero imports; prefer leave alone (YAGNI cleanup).

Already migrated (do not re-do): shell topbar, project sidenav, projects hub page scaffolding.

---

### Task 1: Promote content-list chips + column header into design system

**Files:**
- Create: `mds-ui/src/app/design-system/utils/content-list-filter.utils.ts` (move from `mds-ui/src/app/ui/content-list-filter.utils.ts`)
- Create: `mds-ui/src/app/design-system/utils/content-list-filter.utils.spec.ts` (move existing `ui/content-list-filter.utils.spec.ts`)
- Create: `mds-ui/src/app/design-system/patterns/ld-content-list-filter-chips/ld-content-list-filter-chips.component.ts` (+ html/scss/spec)
- Create: `mds-ui/src/app/design-system/patterns/ld-content-list-column-header/ld-content-list-column-header.component.ts` (+ html/scss/spec)
- Modify: `mds-ui/src/app/design-system/index.ts`
- Modify consumers:
  - `mds-ui/src/app/features/dashboards/dashboards-list-page/dashboards-list-page.component.ts` (+ html)
  - `mds-ui/src/app/features/charts/charts-list-page/charts-list-page.component.ts` (+ html)
  - `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.ts` (+ html)
- Delete (after consumers updated): old `ui/content-list-filter-chips/**`, `ui/content-list-column-header/**`, `ui/content-list-filter.utils.ts`, `ui/content-list-filter.utils.spec.ts`
- Leave: `ui/content-list-filter-bar/**` (unused; out of scope unless you find an import)

**Interfaces:**
- Consumes: existing filter utils types (`ActiveFilterChip`, `ColumnFilterValue`, etc.)
- Produces (barrel):
  - `LdContentListFilterChipsComponent` selector `ld-content-list-filter-chips`
  - `LdContentListColumnHeaderComponent` selector `ld-content-list-column-header`
  - Re-export filter utils types/functions needed by consumers from the barrel (or from `design-system/utils/...` **only if** also re-exported by barrel — prefer barrel re-exports of types used by pages)

**API (preserve behavior; rename selectors/classes):**

```ts
// ld-content-list-filter-chips
readonly chips = input<ActiveFilterChip[]>([]);
readonly clearChip = output<string>();
readonly clearAll = output<void>();

// ld-content-list-column-header — same inputs/outputs as ContentListColumnHeaderComponent
readonly label = input.required<string>();
readonly filterType = input.required<ColumnFilterType>();
readonly options = input<SelectOption[]>([]);
readonly textPlaceholder = input<string | null>(null);
readonly value = input.required<ColumnFilterValue>();
readonly valueChange = output<ColumnFilterValue>();
```

- [ ] **Step 1: Move utils + write/adjust failing consumer compile by changing selectors in one list page first (TDD for new thin wrapper specs)**

Add `ld-content-list-filter-chips.component.spec.ts`:

```ts
it('projects chips and emits clearChip / clearAll', () => {
  // create component, set chips input, click remove on first chip → clearChip.emit(key)
  // click clear-all → clearAll.emit()
});
```

Add `ld-content-list-column-header.component.spec.ts` covering: renders label; opens filter menu for `filterType="text"`; emitting `valueChange` on apply (mirror any critical behavior from previous usage — at least label + active class when filter active).

- [ ] **Step 2: Implement by moving code**

Move utils; create `Ld*` components by adapting existing `app-content-list-*` (selector `ld-*`, BEM prefix `ld-content-list-*`, semantic tokens in SCSS). Export from `index.ts`.

- [ ] **Step 3: Point all three consumers at barrel imports and `ld-*` selectors; delete old files**

- [ ] **Step 4: Run tests**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/design-system/**/*.spec.ts' --include='src/app/ui/content-list-filter.utils.spec.ts' --include='src/app/features/dashboards/dashboards-list-page/**/*.spec.ts' --include='src/app/features/charts/charts-list-page/**/*.spec.ts' --include='src/app/features/tables/table-hub-page/**/*.spec.ts'
```

If utils spec path moved, use the new path. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/design-system mds-ui/src/app/features/dashboards/dashboards-list-page mds-ui/src/app/features/charts/charts-list-page mds-ui/src/app/features/tables/table-hub-page
# also git add -u for deleted ui/ content-list files
git commit -m "$(cat <<'EOF'
feat(design-system): promote content-list filter patterns

Move chips/column-header (+ utils) into the design-system barrel so list pages share one Ld* implementation.
EOF
)"
```

---

### Task 2: Migrate settings list pages (warehouses + users)

**Files:**
- Modify: `mds-ui/src/app/features/warehouses/warehouses-page/warehouses-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/auth/users-page/users-page.component.{html,ts,scss,spec.ts}`

**Interfaces:**
- Consumes: `LdPageFrame`, `LdPageHeader`, `LdEmptyState`, `LdButton`, `LdIconButton` (optional for warehouses delete if density OK — otherwise keep `mat-icon-button` on cards)
- Produces: pages with `ld-page-frame` wrapping content; header title/subtitle + create action via `[ldActions]`; empty via `ld-empty-state` + CTA

- [ ] **Step 1: Update/add failing specs** asserting `ld-page-header` title and create `ld-button` present when loaded.

- [ ] **Step 2: Warehouses template (representative)**

Replace:

```html
<section class="warehouses">
  <div class="page__container">
    <header class="warehouses__header">…</header>
    …
    <div class="warehouses__empty">…</div>
```

With:

```html
<section class="warehouses">
  <ld-page-frame>
    <ld-page-header
      [title]="'warehouses.title' | translate"
      [subtitle]="'warehouses.subtitle' | translate"
    >
      <ld-button ldActions type="button" icon="add" (click)="openCreate()">
        {{ 'warehouses.create' | translate }}
      </ld-button>
    </ld-page-header>

    @if (loading()) { … }
    @else if (error()) { … }
    @else if (warehouses().length === 0) {
      <ld-empty-state icon="storage" [title]="'warehouses.empty' | translate">
        <ld-button ldCta variant="outlined" type="button" (click)="openCreate()">
          {{ 'warehouses.createFirst' | translate }}
        </ld-button>
      </ld-empty-state>
    } @else { … grid … }
  </ld-page-frame>
</section>
```

Import from `../../../design-system`. Swap users page similarly (`person_add` icon on create; empty `ld-empty-state`; row actions can stay `mat-stroked-button` **or** become `ld-button variant="outlined" tone="neutral"` — prefer `ld-button` for those row actions).

- [ ] **Step 3: Replace brand hex / `--ld-navy` in touched SCSS with semantic tokens; drop obsolete header/empty SCSS now owned by Ld\*.**

- [ ] **Step 4: Run page specs + commit**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/features/warehouses/warehouses-page/**/*.spec.ts' --include='src/app/features/auth/users-page/**/*.spec.ts'
```

```bash
git commit -m "$(cat <<'EOF'
feat(settings): adopt design-system page chrome on warehouses and users

Use Ld page frame/header/empty/button for management list scaffolding.
EOF
)"
```

---

### Task 3: Migrate project create/edit + warehouse edit form pages

**Files:**
- Modify: `mds-ui/src/app/features/projects/project-create-page/project-create-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/projects/project-edit-page/project-edit-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/warehouses/warehouse-edit-page/warehouse-edit-page.component.{html,ts,scss,spec.ts}`

**Pattern:** Keep existing breadcrumb nav above the header (page-local). Inside `ld-page-frame`:

```html
<ld-page-frame>
  <!-- existing breadcrumb markup -->
  <ld-page-header
    [title]="'projects.create.title' | translate"
    [subtitle]="'projects.create.subtitle' | translate"
  />
  <!-- form unchanged except primary/secondary buttons → ld-button -->
</ld-page-frame>
```

Submit/cancel/delete actions: `ld-button` (`type="submit"` for save; `variant="outlined"` / `tone="neutral"` for cancel; destructive may stay stroked Material **or** `ld-button variant="outlined"` with existing warn class on host — do not invent a new destructive tone unless already on `LdButton`).

- [ ] **Step 1: Specs** — assert `ld-page-frame` / `ld-page-header` / save `ld-button` where specs exist; update selectors that previously queried `mat-flat-button`.

- [ ] **Step 2: Implement all three pages**

- [ ] **Step 3: Test + commit**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/features/projects/project-create-page/**/*.spec.ts' --include='src/app/features/projects/project-edit-page/**/*.spec.ts' --include='src/app/features/warehouses/warehouse-edit-page/**/*.spec.ts'
```

```bash
git commit -m "$(cat <<'EOF'
feat(settings): migrate project and warehouse form pages to Ld chrome

Align create/edit scaffolding and primary actions with the design system.
EOF
)"
```

---

### Task 4: Migrate project content list pages (dashboards, charts, explorer list)

**Files:**
- Modify: `mds-ui/src/app/features/dashboards/dashboards-list-page/dashboards-list-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/charts/charts-list-page/charts-list-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/explorer/explorer-list-page/explorer-list-page.component.{html,ts,scss,spec.ts}`

**Pattern (dashboards — charts/explorer analogous):**

```html
<div class="page-layout">
  <aside class="page-layout__sidebar" appResizableSidebar>…unchanged sidenav…</aside>
  <div class="page-layout__content">
    <section class="dashboards-list">
      <ld-page-frame [wide]="true">
        <nav class="dashboards-list__breadcrumbs" …>…</nav>

        <ld-page-header [title]="'dashboards.title' | translate">
          <ld-button ldActions type="button" icon="add" (click)="openCreatePage()">
            {{ 'dashboards.create.action' | translate }}
          </ld-button>
        </ld-page-header>

        @if (loading()) { … }
        @else if (error()) { … }
        @else if (dashboards().length === 0) {
          <ld-empty-state icon="dashboard" [title]="'dashboards.empty' | translate">
            <ld-button ldCta type="button" icon="add" (click)="openCreatePage()">
              {{ 'dashboards.create.action' | translate }}
            </ld-button>
          </ld-empty-state>
        } @else {
          <ld-content-list-filter-chips … />
          @if (filteredDashboards().length === 0) {
            <ld-empty-state icon="search_off" [title]="…" />
          } @else {
            <div class="dashboards-list__table-wrap">
              <table>… <ld-content-list-column-header … /> …</table>
            </div>
          }
        }
      </ld-page-frame>
    </section>
  </div>
</div>
```

Explorer list: no create button; use header + empty only. Charts: navigate via `(click)` + `Router` instead of `a mat-flat-button`.

- [ ] **Step 1: Update specs** for create button / empty state selectors.

- [ ] **Step 2: Implement three pages; token-clean touched SCSS (remove duplicate title/create-btn brand rules owned by Ld\*).**

- [ ] **Step 3: Test + commit**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/features/dashboards/dashboards-list-page/**/*.spec.ts' --include='src/app/features/charts/charts-list-page/**/*.spec.ts' --include='src/app/features/explorer/explorer-list-page/**/*.spec.ts'
```

```bash
git commit -m "$(cat <<'EOF'
feat(lists): migrate dashboards, charts, and tables list chrome to Ld*

Use page frame/header/empty/button and promoted content-list patterns.
EOF
)"
```

---

### Task 5: Migrate dashboard create + lineage page chrome

**Files:**
- Modify: `mds-ui/src/app/features/dashboards/dashboard-create-page/dashboard-create-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/lineage/lineage-page/lineage-page.component.{html,ts,scss,spec.ts}`

**Dashboard create:** same as Task 3 form pattern (`ld-page-frame` + breadcrumbs + `ld-page-header` + `ld-button` submit/cancel).

**Lineage:** Keep workspace/graph layout. Wrap header block:

```html
<ld-page-frame [wide]="true">
  <nav class="lineage-page__breadcrumbs">…</nav>
  <ld-page-header
    [title]="…"
    [subtitle]="null"
  />
  <!-- keep rich subtitle meta as page-local content under header if too complex for subtitle string -->
  …
</ld-page-frame>
```

If the lineage subtitle is a multi-chip meta row, keep it as sibling markup under the header rather than forcing it into `subtitle` input. Primary empty/error can use `ld-empty-state` when it is a simple title/body.

- [ ] **Step 1–3: Specs, implement, test, commit**

```bash
git commit -m "$(cat <<'EOF'
feat(ui): migrate dashboard create and lineage page chrome to Ld*

Align create form and lineage header scaffolding with design-system patterns.
EOF
)"
```

---

### Task 6: Migrate dashboard view + chart view toolbar actions

**Files:**
- Modify: `mds-ui/src/app/features/dashboards/dashboard-view-page/dashboard-view-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.{html,ts,scss,spec.ts}`

**Scope:** Replace page header / toolbar **action buttons** with `LdButton` / `LdIconButton` where they are chrome actions (Edit, Save, Cancel, Add tile, Export entry points that are flat/stroked buttons). Prefer composing title row with `ld-page-header` **if** the title/actions structure maps cleanly; if the header is heavily specialized (views menu, filters bar, dual edit/view modes), keep the specialized layout but swap buttons to `ld-button` / `ld-icon-button` and wrap outer width with `ld-page-frame [wide]="true"` where `page__container` is used.

**Out of scope for this task:** tile grid internals, chart viz canvas, filter dialogs, raw Material menus used for overflow — leave menu triggers as Material if `LdIconButton` cannot host `matMenuTriggerFor` cleanly. If a menu trigger must stay Material, note it in the task report.

- [ ] **Step 1: Identify each `mat-flat-button` / `mat-stroked-button` / toolbar `mat-icon-button` in the two templates; migrate those that are simple click actions.**

- [ ] **Step 2: Update specs querying old button selectors.**

- [ ] **Step 3: Test + commit**

```bash
git commit -m "$(cat <<'EOF'
feat(workspace): adopt Ld buttons on dashboard and chart view chrome

Replace header/toolbar Material action buttons with design-system primitives.
EOF
)"
```

---

### Task 7: Migrate explorer workspace + table hub chrome

**Files:**
- Modify: `mds-ui/src/app/features/explorer/explorer-page/explorer-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.{html,ts,scss,spec.ts}`
- Optionally touch panel headers only if they duplicate page-header patterns with primary actions:
  - `tables-fields-panel`, `tables-filters-panel`, `tables-chart-config-panel` — migrate **only** clear page-level / panel primary actions to `ld-button` when already using `mat-flat-button` for the same role; do not redesign panels.

**Pattern:** Outer `page__container` → `ld-page-frame`; picker/empty states → `ld-empty-state`; primary Run/Save/Create actions → `ld-button`. Keep `app-run-query-button` in `shared/` (feature widget — do not move into DS). Replace brand `var(--ld-navy)` in touched SCSS with `--ld-color-brand`.

- [ ] **Step 1–3: Specs, implement, test, commit**

```bash
git commit -m "$(cat <<'EOF'
feat(explore): migrate explorer and table hub chrome to design system

Use Ld frame/empty/button for workspace scaffolding without moving query widgets.
EOF
)"
```

---

### Task 8: Migrate auth entry pages (login, setup, reset-password)

**Files:**
- Modify: `mds-ui/src/app/features/auth/login-page/login-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/auth/setup-page/setup-page.component.{html,ts,scss,spec.ts}`
- Modify: `mds-ui/src/app/features/auth/reset-password-page/reset-password-page.component.{html,ts,scss,spec.ts}`

**Scope:** Primary submit CTAs → `ld-button type="submit"`; brand mark if present → `LdBrandMark` when the page shows the product mark; replace hard-coded brand hex in touched SCSS with tokens. Do **not** invent a full auth layout pattern. Form fields stay Material.

- [ ] **Step 1–3: Specs, implement, test, commit**

```bash
git commit -m "$(cat <<'EOF'
feat(auth): use design-system buttons and tokens on auth pages

Align login/setup/reset primary actions and brand color with Ld primitives.
EOF
)"
```

---

### Task 9: Remaining chrome sweep + semantic token cleanup on migrated surfaces

**Files (inspect and migrate only if still raw chrome):**
- `mds-ui/src/app/features/lineage/lineage-detail-panel/**` — primary actions only
- `mds-ui/src/app/layout/navbar/**` — only if any leftover raw mat chrome not already behind `LdAppTopbar`
- Any remaining `*page*.html` under `features/` still using `page__container` without `ld-page-frame`, or page-level `mat-flat-button` for create/save
- Touched SCSS still using `var(--ld-navy)` for brand → `--ld-color-brand`

**Also:**
- Confirm `projects-page` card settings still intentionally uses dense `mat-icon-button` (OK).
- Grep for deep imports into `design-system/primitives` or `patterns` from features — fix to barrel only.
- Revert `mds-ui/tsconfig.json` exclude-specs change if still dirty.

- [ ] **Step 1: Inventory grep**

```bash
rg -n "page__container|mat-flat-button|mat-stroked-button" mds-ui/src/app/features --glob '*page*.html'
rg -n "design-system/primitives|design-system/patterns" mds-ui/src/app --glob '*.ts'
```

- [ ] **Step 2: Fix remaining in-scope hits; leave dialogs/shared widgets documented in report.**

- [ ] **Step 3: Commit**

```bash
git commit -m "$(cat <<'EOF'
refactor(ui): finish design-system chrome sweep on remaining pages

Close leftover page scaffolding gaps and normalize brand token usage.
EOF
)"
```

---

### Task 10: Verification before completion

**Files:** none expected (tests + report only)

- [ ] **Step 1: Run focused design-system + migrated page suites**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/design-system/**/*.spec.ts'
```

- [ ] **Step 2: Run a broader features smoke** (or full unit test if feasible in time):

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/features/**/*.spec.ts'
```

If full features suite is too slow/flaky, run all `*page*.spec.ts` plus design-system specs and note gaps.

- [ ] **Step 3: Write deliverable notes into** `.superpowers/sdd/progress-design-system-app-migration.md` listing: commits, screens migrated, deferred (dialogs, shared widgets, unused filter-bar), test commands + results.

- [ ] **Step 4: Commit docs/progress only if the plan file was modified earlier in the branch; progress ledger stays untracked under `.superpowers/` (gitignored) — do not force-add it.**

If the plan file itself was added in this effort and not yet committed:

```bash
git add docs/superpowers/plans/2026-09-02-design-system-app-migration.md
git commit -m "$(cat <<'EOF'
docs: add design-system app migration plan

Describe remaining mds-ui screen migration onto Ld* patterns.
EOF
)"
```

(Prefer committing the plan **before** Task 1 starts.)

---

## Self-review (plan author)

1. **Spec coverage:** Follow-up wave “broader Material wrapping + migrate remaining screens” + “data surfaces” from the design-system spec are covered by Tasks 1–9 without Storybook or backend work.
2. **Placeholders:** None intentionally left as TBD; dialogs/shared explicitly deferred with rationale.
3. **Type consistency:** Barrel exports `LdContentList*` + existing `Ld*`; pages import only from barrel.

## Execution

Execute with **Subagent-Driven Development** only. Continuous execution — no “should I continue?” pauses.
