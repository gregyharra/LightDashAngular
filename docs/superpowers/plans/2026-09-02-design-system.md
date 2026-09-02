# Data Platform Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Execute task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an identity-first `Ld*` design system (tokens, Material wrappers, shell/page patterns) under `mds-ui/src/app/design-system/` and wire identity chrome through it.

**Architecture:** CSS semantic tokens → Material theme bridge → thin `Ld*` primitives wrapping Angular Material → shell/page patterns with slots → `app-shell` / `project-browse-nav` / projects hub consume the public barrel only.

**Tech Stack:** Angular 20 standalone components, Angular Material 20 (prebuilt azure-blue + CSS var overrides), SCSS, Jasmine/Karma, ngx-translate for product copy (not inside primitives).

## Global Constraints

- Work only under `mds-ui/` (plus i18n JSON if needed). Do not commit `.tmp/`.
- Selectors: `ld-*` for design-system; keep `app-*` for layout/features.
- Import path: features/layout import only from `mds-ui/src/app/design-system/index.ts` (relative path `../../design-system` or similar). No deep imports into `primitives/` or `patterns/`.
- Design-system SCSS: semantic CSS variables only — no brand hex literals in component styles.
- Chromium + Firefox; no horizontal page scroll; `min-width: 0` on flex children; action buttons `white-space: nowrap` + `flex-shrink: 0`.
- Keep existing routes and behavior; restyle/extract only.
- Leave `shared/` and `ui/` alone except when a pattern clearly replaces a page-local empty/header.
- Commit after each task on branch `feat/design-system`.
- Spec: `docs/superpowers/specs/2026-09-02-design-system-design.md`.

---

## File structure (locked)

```text
mds-ui/src/styles/_lightdash-theme.scss     # add semantic token aliases
mds-ui/src/styles/_material-bridge.scss     # map tokens → --mat-sys-*
mds-ui/src/styles.scss                      # @use material-bridge

mds-ui/src/app/design-system/
  index.ts
  primitives/
    ld-button/
    ld-icon-button/
    ld-brand-mark/
    ld-search-field/
  patterns/
    ld-action-cluster/
    ld-page-header/
    ld-page-frame/
    ld-empty-state/
    ld-app-topbar/
    ld-project-sidenav/
```

---

### Task 1: Semantic tokens + Material theme bridge

**Files:**
- Modify: `mds-ui/src/styles/_lightdash-theme.scss`
- Create: `mds-ui/src/styles/_material-bridge.scss`
- Modify: `mds-ui/src/styles.scss`

**Interfaces:**
- Produces CSS variables (on `:root`):
  - `--ld-color-brand` → `var(--ld-navy)`
  - `--ld-color-brand-ink` → `var(--ld-navy-ink)`
  - `--ld-color-fg` → `var(--ld-foreground)`
  - `--ld-color-bg` → `var(--ld-background)`
  - `--ld-color-surface` → `var(--ld-gray-0)`
  - `--ld-color-border` → `var(--ld-gray-2)`
  - `--ld-color-muted` → `var(--ld-gray-6)`
  - `--ld-space-xxs` … `--ld-space-xxl` aliases of existing `--ld-spacing-*`
  - `--ld-radius-sm|md|pill` already exist (keep)
  - `--ld-font-size-xs|sm` already exist (keep)
- Produces Material bridge mapping at least:
  - `--mat-sys-primary: var(--ld-color-brand)`
  - `--mat-sys-on-primary: #ffffff`
  - `--mat-sys-surface: var(--ld-color-bg)`
  - `--mat-sys-on-surface: var(--ld-color-fg)`
  - `--mat-sys-outline-variant: var(--ld-color-border)`

- [ ] **Step 1: Add semantic aliases to `_lightdash-theme.scss`**

Append inside `:root` (after existing vars; do not remove palette vars):

```scss
  /* Semantic aliases (prefer these in new UI) */
  --ld-color-brand: var(--ld-navy);
  --ld-color-brand-ink: var(--ld-navy-ink);
  --ld-color-fg: var(--ld-foreground);
  --ld-color-bg: var(--ld-background);
  --ld-color-surface: var(--ld-gray-0);
  --ld-color-border: var(--ld-gray-2);
  --ld-color-muted: var(--ld-gray-6);

  --ld-space-xxs: var(--ld-spacing-xxs);
  --ld-space-xs: var(--ld-spacing-xs);
  --ld-space-sm: var(--ld-spacing-sm);
  --ld-space-md: var(--ld-spacing-md);
  --ld-space-lg: var(--ld-spacing-lg);
  --ld-space-xl: var(--ld-spacing-xl);
  --ld-space-xxl: var(--ld-spacing-xxl);
```

- [ ] **Step 2: Create `_material-bridge.scss`**

```scss
// Map Data Platform semantic tokens onto Angular Material M3 system vars
// (prebuilt azure-blue.css loads first; these override on :root).
:root {
  --mat-sys-primary: var(--ld-color-brand);
  --mat-sys-on-primary: #ffffff;
  --mat-sys-primary-container: var(--ld-blue-0);
  --mat-sys-on-primary-container: var(--ld-color-brand-ink);
  --mat-sys-surface: var(--ld-color-bg);
  --mat-sys-on-surface: var(--ld-color-fg);
  --mat-sys-surface-container: var(--ld-color-surface);
  --mat-sys-outline-variant: var(--ld-color-border);
}
```

- [ ] **Step 3: Import bridge in `styles.scss`**

Immediately after `@use 'styles/lightdash-theme';` add:

```scss
@use 'styles/material-bridge';
```

- [ ] **Step 4: Smoke compile**

Run: `cd mds-ui && npx ng build --configuration=development 2>&1 | tail -30`  
Expected: build succeeds (exit 0).

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/styles/_lightdash-theme.scss mds-ui/src/styles/_material-bridge.scss mds-ui/src/styles.scss
git commit -m "$(cat <<'EOF'
style: add semantic design tokens and Material theme bridge

EOF
)"
```

---

### Task 2: Primitives — LdButton, LdIconButton, LdBrandMark, LdSearchField + barrel

**Files:**
- Create: `mds-ui/src/app/design-system/primitives/ld-button/ld-button.component.ts`
- Create: `mds-ui/src/app/design-system/primitives/ld-button/ld-button.component.spec.ts`
- Create: `mds-ui/src/app/design-system/primitives/ld-icon-button/ld-icon-button.component.ts`
- Create: `mds-ui/src/app/design-system/primitives/ld-icon-button/ld-icon-button.component.spec.ts`
- Create: `mds-ui/src/app/design-system/primitives/ld-brand-mark/ld-brand-mark.component.ts`
- Create: `mds-ui/src/app/design-system/primitives/ld-brand-mark/ld-brand-mark.component.spec.ts`
- Create: `mds-ui/src/app/design-system/primitives/ld-search-field/ld-search-field.component.ts`
- Create: `mds-ui/src/app/design-system/primitives/ld-search-field/ld-search-field.component.spec.ts`
- Create: `mds-ui/src/app/design-system/index.ts`

**Interfaces:**
- `LdButtonComponent`
  - selector: `ld-button`
  - inputs: `variant: 'filled' | 'outlined' | 'text' = 'filled'`, `tone: 'primary' | 'neutral' = 'primary'`, `disabled = false`, `loading = false`, `type: 'button' | 'submit' = 'button'`, `icon: string | null = null`
  - host class: `ld-button`, plus `ld-button--{variant}`, `ld-button--{tone}`
  - uses `MatButtonModule` + optional `MatIcon` + spinner when loading
  - `white-space: nowrap; flex-shrink: 0`
- `LdIconButtonComponent`
  - selector: `ld-icon-button`
  - inputs: `icon: string` (required), `ariaLabel: string` (required), `disabled = false`, `tone: 'default' | 'ai' = 'default'`
  - circular 40×40 matching shell icon buttons; semantic token colors
- `LdBrandMarkComponent`
  - selector: `ld-brand-mark`
  - inputs: `showWordmark = true`, `routerLink: string | any[] | null = '/projects'`, `markSrc = 'assets/brand-mark.svg'`, `ariaLabel: string` (required), `title: string | null = null`, `lead: string` (required when showWordmark), `trail: string` (required when showWordmark)
  - renders mark img + optional wordmark (`lead` in `<em>`, then `trail`)
- `LdSearchFieldComponent`
  - selector: `ld-search-field`
  - presentational pill field only (no search service)
  - inputs: `value = ''`, `placeholder = ''`, `ariaLabel: string` (required), `loading = false`
  - outputs: `valueChange`, `focused`, `keydownEvent` (KeyboardEvent)
  - projects optional trailing content via `ng-content`
- Barrel exports all four components (+ later patterns in later tasks).

- [ ] **Step 1: Write failing `LdButton` spec**

```typescript
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LdButtonComponent } from './ld-button.component';

describe('LdButtonComponent', () => {
  let fixture: ComponentFixture<LdButtonComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LdButtonComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(LdButtonComponent);
    fixture.detectChanges();
  });

  it('applies variant and tone host classes', () => {
    fixture.componentRef.setInput('variant', 'outlined');
    fixture.componentRef.setInput('tone', 'neutral');
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.classList.contains('ld-button--outlined')).toBeTrue();
    expect(host.classList.contains('ld-button--neutral')).toBeTrue();
  });

  it('disables the inner button when disabled or loading', () => {
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
    expect(btn.disabled).toBeTrue();
  });
});
```

- [ ] **Step 2: Run button spec — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/ld-button.component.spec.ts'`  
Expected: FAIL (component missing).

- [ ] **Step 3: Implement `LdButtonComponent`**

Standalone component; template uses `@if (variant() === 'filled') { <button mat-flat-button ...> }` / outlined → `mat-stroked-button` / text → `mat-button`. Neutral tone uses CSS class (not Mat color). Loading shows small `mat-spinner` and disables. Styles use `--ld-color-brand`, `--ld-radius-md`, `--ld-space-*` only.

- [ ] **Step 4: Re-run button spec — expect PASS**

- [ ] **Step 5: Write + implement `LdIconButton` with TDD**

Spec asserts `aria-label` on button equals `ariaLabel` input; host has `ld-icon-button`; AI tone adds `ld-icon-button--ai`. Implement circular button with `mat-icon [fontIcon]="icon()"`.

- [ ] **Step 6: Write + implement `LdBrandMark` with TDD**

Spec: with `showWordmark=true`, lead+trail text appear; img `src` is `markSrc`; host link has `routerLink` when provided. Import `RouterLink` + optional router testing via `provideRouter([])`.

- [ ] **Step 7: Write + implement `LdSearchField` with TDD**

Spec: typing emits `valueChange`; `aria-label` set; loading shows spinner. Implement pill layout matching current navbar search field (gray pill, search icon, input).

- [ ] **Step 8: Create barrel `design-system/index.ts`**

```typescript
export { LdButtonComponent } from './primitives/ld-button/ld-button.component';
export { LdIconButtonComponent } from './primitives/ld-icon-button/ld-icon-button.component';
export { LdBrandMarkComponent } from './primitives/ld-brand-mark/ld-brand-mark.component';
export { LdSearchFieldComponent } from './primitives/ld-search-field/ld-search-field.component';
```

- [ ] **Step 9: Run all primitive specs**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/design-system/primitives/**/*.spec.ts'`  
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add mds-ui/src/app/design-system
git commit -m "$(cat <<'EOF'
feat(design-system): add Ld button, icon-button, brand-mark, search-field

EOF
)"
```

---

### Task 3: Page patterns — Frame, Header, ActionCluster, EmptyState

**Files:**
- Create under `mds-ui/src/app/design-system/patterns/`:
  - `ld-action-cluster/` (+ spec)
  - `ld-page-header/` (+ spec)
  - `ld-page-frame/` (+ spec)
  - `ld-empty-state/` (+ spec)
- Modify: `mds-ui/src/app/design-system/index.ts` (export patterns)

**Interfaces:**
- `LdActionClusterComponent` (`ld-action-cluster`): host flex row, `gap`, `flex-shrink: 0` children; projects actions via `ng-content`; class `ld-action-cluster`.
- `LdPageHeaderComponent` (`ld-page-header`):
  - inputs: `title: string` (required), `subtitle: string | null = null`
  - slots: default/`actions` projected into trailing cluster via `<ld-action-cluster><ng-content select="[ldActions]" /></ld-action-cluster>`
  - structure matches `.page-header` / title-row / title-block / actions (reuse existing global page-header layout classes where possible, or mirror them with `ld-page-header__*` using semantic tokens)
- `LdPageFrameComponent` (`ld-page-frame`):
  - input: `wide = false`
  - wraps content in `page__container` / `page__container--wide` + `min-width: 0`; host `display:block; min-width:0; width:100%`
- `LdEmptyStateComponent` (`ld-empty-state`):
  - inputs: `title: string` (required), `body: string | null = null`, `icon: string | null = null`
  - optional CTA via `<ng-content select="[ldCta]">`; CTA absent when no projected content (test with/without)

- [ ] **Step 1: TDD `LdActionCluster`** — assert host class and projected button present.

- [ ] **Step 2: TDD `LdPageHeader`** — assert title/subtitle text; projected `[ldActions]` appears in cluster.

- [ ] **Step 3: TDD `LdPageFrame`** — assert `page__container` vs `--wide` based on `wide` input.

- [ ] **Step 4: TDD `LdEmptyState`** — title always; CTA query only when projected.

- [ ] **Step 5: Update barrel exports**

- [ ] **Step 6: Run**

`cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='**/design-system/patterns/ld-*.spec.ts'`  
(or include each pattern folder). Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add mds-ui/src/app/design-system
git commit -m "$(cat <<'EOF'
feat(design-system): add page frame, header, action cluster, empty state

EOF
)"
```

---

### Task 4: LdAppTopbar + wire `app-shell`

**Files:**
- Create: `mds-ui/src/app/design-system/patterns/ld-app-topbar/` (+ spec)
- Modify: `mds-ui/src/app/design-system/index.ts`
- Modify: `mds-ui/src/app/layout/app-shell/app-shell.component.ts`
- Modify: `mds-ui/src/app/layout/app-shell/app-shell.component.html`
- Modify: `mds-ui/src/app/layout/app-shell/app-shell.component.scss` (remove duplicated brand/topbar chrome now owned by pattern; keep shell layout + content rules)
- Modify: `mds-ui/src/app/layout/app-shell/app-shell.component.spec.ts` (keep behavior tests green)
- Optionally refactor icon buttons in shell to `ld-icon-button` and brand to `ld-brand-mark`

**Interfaces:**
- `LdAppTopbarComponent` (`ld-app-topbar`):
  - three-column grid matching current `.shell__navbar` (brand | center | actions)
  - slots: `[ldBrand]` (or default brand projection), `[ldCenter]`, `[ldActions]`
  - height: `var(--ld-navbar-height)`; background `var(--ld-color-bg)`; border-bottom `var(--ld-color-border)`
- `AppShellComponent` composes:
  - `<ld-app-topbar>` with `ld-brand-mark` (pass translated lead/trail/aria from existing i18n keys), center = `app-navbar-search` or spacer, actions = project switcher + `ld-icon-button`s + user menu
- Do not remove AI / help / notifications / user menu behavior.

- [ ] **Step 1: TDD `LdAppTopbar`** — projected brand/center/actions all render.

- [ ] **Step 2: Implement topbar pattern; export from barrel.**

- [ ] **Step 3: Refactor `app-shell` template to use `LdAppTopbar` + `LdBrandMark` + `LdIconButton`.**

- [ ] **Step 4: Run shell + topbar specs**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless \
  --include='**/ld-app-topbar.component.spec.ts' \
  --include='**/app-shell.component.spec.ts'
```

Expected: PASS (including settings gear / project-active search assertions).

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/design-system mds-ui/src/app/layout/app-shell
git commit -m "$(cat <<'EOF'
feat(shell): compose topbar from design-system patterns

EOF
)"
```

---

### Task 5: LdProjectSidenav + wire project browse nav

**Files:**
- Create: `mds-ui/src/app/design-system/patterns/ld-project-sidenav/` (+ spec)
- Modify: `mds-ui/src/app/design-system/index.ts`
- Modify: `mds-ui/src/app/layout/project-browse-nav/project-browse-nav.component.ts` (become thin orchestrator: owns items + inputs; template uses `ld-project-sidenav` or move presentation into pattern and keep selector `app-project-browse-nav` as wrapper)
- Modify: `mds-ui/src/app/layout/project-browse-nav/project-browse-nav.component.spec.ts`

**Interfaces:**
- `LdProjectSidenavComponent` (`ld-project-sidenav`):
  - inputs: `projectUuid: string`, `active: string`, `items: readonly { id: string; path: string; icon: string; label: string }[]`
  - note: pass **already-translated** `label` strings from parent (pattern stays i18n-agnostic) OR accept `labelKey` + use TranslatePipe — prefer translated labels from parent to keep DS free of ngx-translate
  - home link to `/projects`; nav links to `/projects/:uuid/:path`
  - styles use `--ld-sidebar-dark*` / semantic tokens — replace hard-coded `#cfd3dc` / `#e5e7eb` with variables (add `--ld-color-on-sidebar` / `--ld-color-on-sidebar-muted` to theme if needed in this task)
- Keep `data-testid="project-browse-nav"` and `project-browse-nav-home` for existing tests.

- [ ] **Step 1: Add sidebar on-color semantic tokens if missing** (`--ld-color-on-sidebar`, `--ld-color-on-sidebar-muted`) in `_lightdash-theme.scss`.

- [ ] **Step 2: TDD sidenav pattern** — active item gets active class; home link present.

- [ ] **Step 3: Wire `ProjectBrowseNavComponent` as orchestrator** (translate labels, pass items).

- [ ] **Step 4: Run**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless \
  --include='**/ld-project-sidenav.component.spec.ts' \
  --include='**/project-browse-nav.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/styles/_lightdash-theme.scss mds-ui/src/app/design-system mds-ui/src/app/layout/project-browse-nav
git commit -m "$(cat <<'EOF'
feat(design-system): extract project sidenav pattern

EOF
)"
```

---

### Task 6: Adopt page patterns on projects hub

**Files:**
- Modify: `mds-ui/src/app/features/projects/projects-page/projects-page.component.ts`
- Modify: `mds-ui/src/app/features/projects/projects-page/projects-page.component.html`
- Modify: `mds-ui/src/app/features/projects/projects-page/projects-page.component.scss` (remove header/empty duplication superseded by patterns)
- Modify: `mds-ui/src/app/features/projects/projects-page/projects-page.component.spec.ts` if present / update selectors

**Interfaces / behavior:**
- Wrap hub content with `<ld-page-frame>` (not necessarily `wide`).
- Replace custom header with `<ld-page-header [title]=... [subtitle]=...>` and create button in `[ldActions]` using `<ld-button>` (admin/management mode only, same as today).
- Replace empty state block with `<ld-empty-state>` + optional CTA.
- Preserve domain cards, loading spinner, error display, management vs explore modes.
- Import only from `../../../design-system` barrel.

- [ ] **Step 1: Update template/TS/SCSS to use patterns + `LdButton`.**

- [ ] **Step 2: Run projects + design-system related tests**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless \
  --include='**/projects-page.component.spec.ts' \
  --include='**/design-system/**/*.spec.ts' \
  --include='**/app-shell.component.spec.ts' \
  --include='**/project-browse-nav.component.spec.ts'
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add mds-ui/src/app/features/projects/projects-page mds-ui/src/app/design-system
git commit -m "$(cat <<'EOF'
feat(projects): adopt design-system page patterns on hub

EOF
)"
```

---

## Self-review checklist (plan author)

1. Spec coverage: tokens, Material bridge, primitives, patterns, shell wiring, sidenav, page adoption, barrel-only imports, tests — each has a task.
2. No Storybook / data-surfaces / shared migration in this plan.
3. Names consistent: `Ld*` classes, `ld-*` selectors, semantic `--ld-color-*` / `--ld-space-*`.
