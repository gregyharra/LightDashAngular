# Dpf `shared/ui` restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the in-app UI kit from `design-system/` to `shared/ui/{components,patterns}/` and rename the public API from `Ld*` / `ld-*` to `Dpf*` / `dpf-*` in one pass.

**Architecture:** Keep tokens (`--ld-*`) and Material wrappers as-is. Relocate units into GoNetZero-style flat folders under `shared/ui/`, rename selectors/classes/symbols (including content-projection attrs `ldActions`→`dpfActions`, `ldCta`→`dpfCta`), expose a single barrel at `shared/ui/index.ts`, update all consumers, delete `design-system/` and unused `app/ui/`.

**Tech Stack:** Angular 20 standalone components, Angular Material 20, SCSS, Jasmine/Karma (`npx ng test --no-watch --browsers=ChromeHeadless`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-03-dpf-shared-ui-restructure-design.md`
- Work only under `mds-ui/` (plus this plan/spec under `docs/`). Do not commit `.tmp/`, `out-tsc/`, or `.vscode/`.
- Public API: `Dpf*Component` classes, `dpf-*` selectors, `dpf-*` host/BEM classes.
- Content projection attrs: `dpfActions`, `dpfCta` (replace `ldActions`, `ldCta`).
- CSS tokens stay `--ld-*` / `--ld-button-*` (do not rename tokens in this plan).
- Features/layout import **only** from `mds-ui/src/app/shared/ui/index.ts` (relative `../../shared/ui` or `../../../shared/ui`). No deep imports into `components/` or `patterns/`.
- Do not move or rename feature widgets under `shared/sql-highlight/`, `shared/confirm-dialog/`, etc.
- No behavior/visual redesign — structure + names only.
- No compatibility shims under `design-system/`.
- Chromium + Firefox; no horizontal page scroll; action labels `white-space: nowrap` + `flex-shrink: 0` on buttons.
- Commit after each task on branch `feat/design-system`.

### Rename recipe (apply to every kit unit)

For a unit currently at `design-system/<tier>/ld-<name>/`:

1. Create `shared/ui/<components|patterns>/<name>/`.
2. Rename files: `ld-<name>.component.ts` → `<name>.component.ts` (same for `.spec.ts`, `.html`, `.scss` when present).
3. In those files, replace:
   - `Ld` → `Dpf` in TypeScript type/class names (`LdButtonComponent` → `DpfButtonComponent`)
   - `ld-` → `dpf-` in selectors, host classes, BEM classes, CSS selectors in specs
   - `ldActions` → `dpfActions`, `ldCta` → `dpfCta`
   - Update relative imports between kit units (e.g. page-header → action-cluster)
4. Keep `--ld-*` token references inside styles unchanged.
5. Do **not** leave the old `design-system/` file once the new file exists and tests pass for that unit.

### Consumer replace pairs (Task 4)

| Find | Replace |
|------|---------|
| `from '.../design-system'` | `from '.../shared/ui'` (adjust `../` depth; layout uses `../../shared/ui`, features use `../../../shared/ui`) |
| `LdButtonComponent` | `DpfButtonComponent` |
| `LdIconButtonComponent` | `DpfIconButtonComponent` |
| `LdBrandMarkComponent` | `DpfBrandMarkComponent` |
| `LdSearchFieldComponent` | `DpfSearchFieldComponent` |
| `LdActionClusterComponent` | `DpfActionClusterComponent` |
| `LdAppTopbarComponent` | `DpfAppTopbarComponent` |
| `LdPageHeaderComponent` | `DpfPageHeaderComponent` |
| `LdPageFrameComponent` | `DpfPageFrameComponent` |
| `LdEmptyStateComponent` | `DpfEmptyStateComponent` |
| `LdContentListFilterChipsComponent` | `DpfContentListFilterChipsComponent` |
| `LdContentListColumnHeaderComponent` | `DpfContentListColumnHeaderComponent` |
| `LdProjectSidenavComponent` | `DpfProjectSidenavComponent` |
| `LdProjectSidenavItem` | `DpfProjectSidenavItem` |
| `<ld-` / `</ld-` / `ld-button` / `ld-page-header` / etc. | `<dpf-` / `</dpf-` / `dpf-button` / `dpf-page-header` / etc. |
| `ldActions` | `dpfActions` |
| `ldCta` | `dpfCta` |

Do **not** replace `--ld-` token names or unrelated strings like `lightdash`.

---

## File structure (locked)

```text
mds-ui/src/app/shared/ui/
  index.ts
  components/
    button/          button.component.ts + .spec.ts
    icon-button/     icon-button.component.ts + .spec.ts
    brand-mark/      brand-mark.component.ts + .spec.ts
    search-field/    search-field.component.ts + .spec.ts
  patterns/
    action-cluster/                 + .spec.ts
    app-topbar/                     + .spec.ts
    page-header/                    + .spec.ts
    page-frame/                     + .spec.ts
    empty-state/                    + .spec.ts
    content-list-filter-chips/      .ts/.html/.scss + .spec.ts
    content-list-column-header/     .ts/.html/.scss + .spec.ts
    project-sidenav/                + .spec.ts
  utils/
    content-list-filter.utils.ts
    content-list-filter.utils.spec.ts

DELETE after migration:
  mds-ui/src/app/design-system/   (entire tree)
  mds-ui/src/app/ui/              (unused content-list-filter-bar only occupant)
```

**Source → destination map**

| From | To |
|------|----|
| `design-system/primitives/ld-button/*` | `shared/ui/components/button/*` |
| `design-system/primitives/ld-icon-button/*` | `shared/ui/components/icon-button/*` |
| `design-system/primitives/ld-brand-mark/*` | `shared/ui/components/brand-mark/*` |
| `design-system/primitives/ld-search-field/*` | `shared/ui/components/search-field/*` |
| `design-system/patterns/ld-action-cluster/*` | `shared/ui/patterns/action-cluster/*` |
| `design-system/patterns/ld-app-topbar/*` | `shared/ui/patterns/app-topbar/*` |
| `design-system/patterns/ld-page-header/*` | `shared/ui/patterns/page-header/*` |
| `design-system/patterns/ld-page-frame/*` | `shared/ui/patterns/page-frame/*` |
| `design-system/patterns/ld-empty-state/*` | `shared/ui/patterns/empty-state/*` |
| `design-system/patterns/ld-content-list-filter-chips/*` | `shared/ui/patterns/content-list-filter-chips/*` |
| `design-system/patterns/ld-content-list-column-header/*` | `shared/ui/patterns/content-list-column-header/*` |
| `design-system/patterns/ld-project-sidenav/*` | `shared/ui/patterns/project-sidenav/*` |
| `design-system/utils/content-list-filter.utils.ts` (+ `.spec.ts`) | `shared/ui/utils/` |
| `design-system/index.ts` | replaced by `shared/ui/index.ts` (no shim) |

---

### Task 1: Migrate components (`button`, `icon-button`, `brand-mark`, `search-field`)

**Files:**
- Create: `mds-ui/src/app/shared/ui/components/button/button.component.ts`
- Create: `mds-ui/src/app/shared/ui/components/button/button.component.spec.ts`
- Create: `mds-ui/src/app/shared/ui/components/icon-button/icon-button.component.ts`
- Create: `mds-ui/src/app/shared/ui/components/icon-button/icon-button.component.spec.ts`
- Create: `mds-ui/src/app/shared/ui/components/brand-mark/brand-mark.component.ts`
- Create: `mds-ui/src/app/shared/ui/components/brand-mark/brand-mark.component.spec.ts`
- Create: `mds-ui/src/app/shared/ui/components/search-field/search-field.component.ts`
- Create: `mds-ui/src/app/shared/ui/components/search-field/search-field.component.spec.ts`
- Keep old `design-system/primitives/**` until Task 5 deletes the tree (consumers still import the barrel until Task 4).

**Interfaces:**
- Produces: `DpfButtonComponent` (`selector: 'dpf-button'`), `DpfIconButtonComponent`, `DpfBrandMarkComponent`, `DpfSearchFieldComponent`
- Produces types: `DpfButtonVariant = 'filled' | 'outlined' | 'text'`, `DpfButtonTone = 'primary' | 'neutral'`
- Consumes: Angular Material button/icon/spinner; CSS vars `--ld-button-*`, `--ld-color-*`, `--ld-radius-*` (unchanged)

- [ ] **Step 1: Write failing button spec at the new path (TDD)**

Create `mds-ui/src/app/shared/ui/components/button/button.component.spec.ts` by copying `design-system/primitives/ld-button/ld-button.component.spec.ts` and applying the rename recipe so it imports `./button.component`, uses `DpfButtonComponent` / `DpfButtonHostComponent`, and asserts `dpf-button`, `.dpf-button__icon`, `.dpf-button__label`, host classes `dpf-button--outlined`, etc.

Do **not** create `button.component.ts` yet.

- [ ] **Step 2: Run button spec — expect FAIL (module not found)**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/shared/ui/components/button/button.component.spec.ts'
```

Expected: FAIL — cannot resolve `./button.component` or `DpfButtonComponent`.

- [ ] **Step 3: Implement `button.component.ts`**

Copy `ld-button.component.ts` → `button.component.ts` with rename recipe. Critical public surface after rename:

```typescript
export type DpfButtonVariant = 'filled' | 'outlined' | 'text';
export type DpfButtonTone = 'primary' | 'neutral';

@Component({
  selector: 'dpf-button',
  // ...
  host: {
    class: 'dpf-button',
    '[class.dpf-button--filled]': "variant() === 'filled'",
    '[class.dpf-button--outlined]': "variant() === 'outlined'",
    '[class.dpf-button--text]': "variant() === 'text'",
    '[class.dpf-button--primary]': "tone() === 'primary'",
    '[class.dpf-button--neutral]': "tone() === 'neutral'",
  },
  template: `
    <button ...>
      <span class="dpf-button__content">
        ...
        <mat-icon class="dpf-button__icon" ...>
        <span class="dpf-button__label"><ng-content /></span>
      </span>
    </button>
  `,
})
export class DpfButtonComponent { /* same inputs as LdButtonComponent */ }
```

Keep all `--ld-button-*` / `--ld-color-*` / `--ld-radius-*` references.

- [ ] **Step 4: Run button spec — expect PASS**

Same command as Step 2. Expected: PASS.

- [ ] **Step 5: Migrate icon-button, brand-mark, search-field the same way**

For each remaining component:
1. Write renamed spec under `shared/ui/components/<name>/`
2. Run `--include='**/shared/ui/components/<name>/<name>.component.spec.ts'` — FAIL without implementation
3. Add renamed component file
4. Run again — PASS

Preserve each component’s existing inputs/outputs/behavior; only names/paths change.

- [ ] **Step 6: Commit**

```bash
git add mds-ui/src/app/shared/ui/components
git commit -m "$(cat <<'EOF'
refactor(ui): add Dpf components under shared/ui

Move button, icon-button, brand-mark, and search-field into the GoNetZero-style shared/ui components tree with Dpf naming.
EOF
)"
```

---

### Task 2: Migrate patterns + utils

**Files:**
- Create all pattern folders under `mds-ui/src/app/shared/ui/patterns/` per the map above
- Create: `mds-ui/src/app/shared/ui/utils/content-list-filter.utils.ts`
- Create: `mds-ui/src/app/shared/ui/utils/content-list-filter.utils.spec.ts`

**Interfaces:**
- Produces: `DpfActionClusterComponent`, `DpfAppTopbarComponent`, `DpfPageHeaderComponent`, `DpfPageFrameComponent`, `DpfEmptyStateComponent`, `DpfContentListFilterChipsComponent`, `DpfContentListColumnHeaderComponent`, `DpfProjectSidenavComponent`, `DpfProjectSidenavItem`
- Produces: same utils API as today (`sharedSpaceFilterValue`, `ColumnFilterType`, filter helpers, etc.) — no `Ld` prefix on utils (already generic)
- Content projection: `select="[dpfActions]"`, `select="[dpfCta]"`; styles targeting `[dpfCta]`
- Internal imports: patterns import sibling patterns/components via **relative paths within `shared/ui`**, e.g. page-header imports `../../components/button` only if needed — today page-header imports action-cluster relatively; update to `../action-cluster/action-cluster.component`

- [ ] **Step 1: Migrate utils first (pure TS)**

Copy utils + spec with path change only (no `Ld` symbols). Run:

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/shared/ui/utils/content-list-filter.utils.spec.ts'
```

Expected: PASS.

- [ ] **Step 2: Migrate action-cluster, page-frame, empty-state (no cross-kit deps beyond Material)**

Apply rename recipe. Empty-state must use `dpfCta`:

```typescript
<ng-content select="[dpfCta]" />
// styles: :host ::ng-deep > [dpfCta] { ... }
```

Run each unit’s spec with `--include='**/shared/ui/patterns/<name>/<name>.component.spec.ts'`.

- [ ] **Step 3: Migrate page-header and app-topbar (depend on action-cluster / projection)**

`page-header` template after rename:

```html
<dpf-action-cluster class="dpf-page-header__actions page-header__actions">
  <ng-content select="[dpfActions]" />
</dpf-action-cluster>
```

Update specs that project `[ldActions]` → `[dpfActions]`.

- [ ] **Step 4: Migrate content-list-* patterns and project-sidenav**

Apply rename recipe to TS/HTML/SCSS/specs. Update any internal `ld-*` class names in SCSS/HTML. Keep `data-testid` values used by layout tests unchanged (e.g. project browse nav test ids on the layout wrapper, not necessarily on the kit).

- [ ] **Step 5: Run all new pattern + utils specs**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/shared/ui/**/*.spec.ts'
```

Expected: PASS for all migrated kit tests (old `design-system` specs still exist and should still pass until Task 5).

- [ ] **Step 6: Commit**

```bash
git add mds-ui/src/app/shared/ui/patterns mds-ui/src/app/shared/ui/utils
git commit -m "$(cat <<'EOF'
refactor(ui): add Dpf patterns and utils under shared/ui

Relocate shell/page patterns and content-list helpers with dpf-* selectors and projection attrs.
EOF
)"
```

---

### Task 3: Public barrel `shared/ui/index.ts`

**Files:**
- Create: `mds-ui/src/app/shared/ui/index.ts`

**Interfaces:**
- Produces barrel exports (exact names):

```typescript
export { DpfButtonComponent } from './components/button/button.component';
export type { DpfButtonVariant, DpfButtonTone } from './components/button/button.component';
export { DpfIconButtonComponent } from './components/icon-button/icon-button.component';
export { DpfBrandMarkComponent } from './components/brand-mark/brand-mark.component';
export { DpfSearchFieldComponent } from './components/search-field/search-field.component';
export { DpfActionClusterComponent } from './patterns/action-cluster/action-cluster.component';
export { DpfAppTopbarComponent } from './patterns/app-topbar/app-topbar.component';
export { DpfPageHeaderComponent } from './patterns/page-header/page-header.component';
export { DpfPageFrameComponent } from './patterns/page-frame/page-frame.component';
export { DpfEmptyStateComponent } from './patterns/empty-state/empty-state.component';
export { DpfContentListFilterChipsComponent } from './patterns/content-list-filter-chips/content-list-filter-chips.component';
export {
  DpfContentListColumnHeaderComponent,
  type ColumnFilterType,
  type ColumnFilterValue,
} from './patterns/content-list-column-header/content-list-column-header.component';
export {
  DpfProjectSidenavComponent,
  type DpfProjectSidenavItem,
} from './patterns/project-sidenav/project-sidenav.component';
export * from './utils/content-list-filter.utils';
```

Add a one-line comment at top of the barrel:

```typescript
/** Data Platform UI kit. Import from this barrel only. Tokens remain `--ld-*` until a later rename. */
```

- [ ] **Step 1: Create the barrel file** with the exports above (adjust type export lines if a symbol is not separately exported from the component file — match whatever the component file actually exports).

- [ ] **Step 2: Sanity-check TypeScript resolves the barrel**

```bash
cd mds-ui && npx ng build --configuration=development
```

Expected: build may still succeed via old `design-system` imports; barrel itself must not error. If the build fails only on unrelated WIP, fix only kit-related errors.

- [ ] **Step 3: Commit**

```bash
git add mds-ui/src/app/shared/ui/index.ts
git commit -m "$(cat <<'EOF'
refactor(ui): add shared/ui public barrel for Dpf kit

Export Dpf components and utils from a single import path.
EOF
)"
```

---

### Task 4: Retarget all consumers to `shared/ui` + `Dpf*` / `dpf-*`

**Files (TS imports from design-system — all must change):**
- `mds-ui/src/app/layout/app-shell/app-shell.component.ts`
- `mds-ui/src/app/layout/project-browse-nav/project-browse-nav.component.ts`
- `mds-ui/src/app/features/auth/login-page/login-page.component.ts`
- `mds-ui/src/app/features/auth/setup-page/setup-page.component.ts`
- `mds-ui/src/app/features/auth/reset-password-page/reset-password-page.component.ts`
- `mds-ui/src/app/features/auth/users-page/users-page.component.ts`
- `mds-ui/src/app/features/projects/projects-page/projects-page.component.ts`
- `mds-ui/src/app/features/projects/project-create-page/project-create-page.component.ts`
- `mds-ui/src/app/features/projects/project-edit-page/project-edit-page.component.ts`
- `mds-ui/src/app/features/warehouses/warehouses-page/warehouses-page.component.ts`
- `mds-ui/src/app/features/warehouses/warehouse-form/warehouse-form.component.ts`
- `mds-ui/src/app/features/warehouses/warehouse-edit-page/warehouse-edit-page.component.ts`
- `mds-ui/src/app/features/dashboards/dashboards-list-page/dashboards-list-page.component.ts`
- `mds-ui/src/app/features/dashboards/dashboard-create-page/dashboard-create-page.component.ts`
- `mds-ui/src/app/features/dashboards/dashboard-view-page/dashboard-view-page.component.ts`
- `mds-ui/src/app/features/charts/charts-list-page/charts-list-page.component.ts`
- `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts`
- `mds-ui/src/app/features/explorer/explorer-list-page/explorer-list-page.component.ts`
- `mds-ui/src/app/features/explorer/explorer-page/explorer-page.component.ts`
- `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.ts`
- `mds-ui/src/app/features/tables/table-hub-page/table-hub-page.component.ts`
- `mds-ui/src/app/features/lineage/lineage-page/lineage-page.component.ts`

**Also update matching `.html`, `.scss`, and `*.spec.ts`** that reference `ld-*`, `Ld*`, `ldActions`, `ldCta`, or `design-system` (non-exhaustive but required sweep):
- All HTML under those feature/layout folders using `<ld-…>`
- Specs: `app-shell`, `projects-page`, `dashboards-list-page`, `charts-list-page`, `warehouses-page`, `users-page`, `explorer-list-page`, `login-page`, `setup-page`, `reset-password-page`, and any other spec asserting `ld-` kit selectors
- SCSS that selects `ld-button` (e.g. `reset-password-page.component.scss`) → `dpf-button`

**Interfaces:**
- Consumes: barrel from Task 3 only
- Produces: no kit API changes beyond names already defined

- [ ] **Step 1: Update one vertical (app-shell) end-to-end**

In `app-shell.component.ts`:

```typescript
import {
  DpfAppTopbarComponent,
  DpfBrandMarkComponent,
  // …whatever it currently imports, with Dpf names
} from '../../shared/ui';
```

Update `app-shell.component.html`: `<ld-app-topbar>` → `<dpf-app-topbar>`, `ldActions` → `dpfActions`, etc.

Update `app-shell.component.spec.ts` CSS queries accordingly.

Run:

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/app-shell.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 2: Apply the consumer replace pairs across all remaining TS/HTML/SCSS/spec files listed above**

Use repo search to confirm each `from '...design-system'` import is gone from `mds-ui/src/app/features` and `mds-ui/src/app/layout`.

- [ ] **Step 3: Run a representative consumer suite**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless \
  --include='**/app-shell.component.spec.ts' \
  --include='**/projects-page.component.spec.ts' \
  --include='**/dashboards-list-page.component.spec.ts' \
  --include='**/shared/ui/**/*.spec.ts'
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add mds-ui/src/app/layout mds-ui/src/app/features
git commit -m "$(cat <<'EOF'
refactor(ui): point app chrome at shared/ui Dpf kit

Switch layout and feature imports, templates, and specs from Ld/design-system to Dpf/shared/ui.
EOF
)"
```

---

### Task 5: Delete old trees + leftover `app/ui` + verification sweep

**Files:**
- Delete: entire `mds-ui/src/app/design-system/`
- Delete: entire `mds-ui/src/app/ui/` (only contains unused `content-list-filter-bar`; confirmed no feature imports)
- Modify if needed: any doc references under `docs/superpowers/specs/2026-09-02-design-system-design.md` are **out of scope** unless a broken link is required — do not rewrite old specs in this task

- [ ] **Step 1: Delete `design-system/` and `app/ui/`**

```bash
rm -rf mds-ui/src/app/design-system mds-ui/src/app/ui
```

- [ ] **Step 2: Repo sweep — must return no kit leftovers**

```bash
cd mds-ui && rg -n "design-system|LdButton|LdPageHeader|ld-button|ld-page-header|ldActions|ldCta|selector: 'ld-" src/app --glob '!**/shared/ui/**'
```

Expected: no matches in features/layout/shared feature widgets. (Token `--ld-*` in `src/styles` is OK and out of scope.)

Also:

```bash
cd mds-ui && rg -n "from ['\"].*design-system" src
```

Expected: no matches.

- [ ] **Step 3: Full kit + chrome test run**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless \
  --include='**/shared/ui/**/*.spec.ts' \
  --include='**/app-shell.component.spec.ts' \
  --include='**/project-browse-nav.component.spec.ts' \
  --include='**/projects-page.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 4: Production build**

```bash
cd mds-ui && npx ng build --configuration=production
```

Expected: SUCCESS.

- [ ] **Step 5: Commit**

```bash
git add -A mds-ui/src/app/design-system mds-ui/src/app/ui mds-ui/src/app/shared/ui
# ensure deletions are staged
git add -u mds-ui/src/app/design-system mds-ui/src/app/ui
git commit -m "$(cat <<'EOF'
refactor(ui): remove design-system tree after Dpf migration

Delete the old kit path and unused app/ui leftover now that shared/ui is the sole source.
EOF
)"
```

---

### Task 6: Manual smoke (agent or human)

**Files:** none (verification only)

- [ ] **Step 1: Ensure frontend is serving** (`ng serve` on `:4200`) with backend available for login.

- [ ] **Step 2: Smoke checklist**
  - Login page: primary `<dpf-button>` looks/works
  - After login: topbar brand + actions (`dpf-app-topbar`)
  - Projects hub: `dpf-page-header` + actions + empty/list chrome
  - Open a project: sidenav via project-browse-nav / `dpf-project-sidenav`
  - One list page (dashboards or charts): header action + empty CTA if applicable

- [ ] **Step 3: If smoke finds a missed `ld-*` selector, fix and commit**

```bash
git commit -m "$(cat <<'EOF'
fix(ui): catch missed ld-* references after shared/ui migrate
EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Kit under `shared/ui/{components,patterns}` | 1–2 |
| Flat folders, short names | File structure |
| `Dpf*` / `dpf-*` rename | 1–4 |
| `dpfActions` / `dpfCta` | 2, 4 |
| Single barrel, no deep imports | 3–4 |
| Feature `shared/*` widgets untouched | Global constraints |
| Tokens `--ld-*` unchanged | Global constraints |
| Single-pass, no shims | 5 deletes `design-system/` |
| Delete unused `app/ui` | 5 |
| Tests + smoke | 1–2, 4–6 |

No TBD placeholders. Type names consistent (`Dpf*` throughout).
