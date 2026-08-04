# Charts/new unified shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route `/charts/new` through `ChartViewPageComponent` in create mode (empty draft, edit mode on) so create matches the chart edit builder UI.

**Architecture:** Keep a dedicated `charts/new` route but load `ChartViewPageComponent` with `data: { createMode: true }`. Create mode skips `chartService.get`, starts in edit mode with PROJECT + FIELDS sidebars, and on Save calls `chartService.create` (reuse `SaveChartDialog` for space) then navigates to `/charts/:uuid`. Done cancels to the charts list.

**Tech Stack:** Angular routes, signals, existing `ChartViewPageComponent`, `ChartService.create`, `SaveChartDialogComponent`.

## Global Constraints

- Do not break existing saved-chart view/edit/save (`chartService.update`) flow.
- Create mode must not require a loaded `SavedChart` to render the shell.
- Preserve dual sidebars (Browse + PROJECT + FIELDS) and Filter/Chart/Results/SQL accordion.
- No horizontal page scroll; `min-width: 0` on flex children.
- Do not commit unless the user asks.

---

## File map

| File | Responsibility |
|------|----------------|
| `mds-ui/src/app/app.routes.ts` | Point `charts/new` at chart-view; add `data.createMode` |
| `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts` | Detect create mode; init draft; create save; Done → list |
| `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.html` | Render shell when create (no `chart()`); hide Edit/Done quirks |

`TablesWorkspacePageComponent` remains for `/tables` exploration; only the create-chart entry point changes.

---

### Task 1: Route + create-mode bootstrap

**Files:**
- Modify: `mds-ui/src/app/app.routes.ts`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.html`

- [x] **Step 1:** Change `projects/:projectUuid/charts/new` to lazy-load `ChartViewPageComponent` with `data: { createMode: true }`.
- [x] **Step 2:** In `ChartViewPageComponent`, read `route.data` / URL for create mode. Add `isCreateMode` signal/computed.
- [x] **Step 3:** On create: set `projectUuid`, `editMode=true`, `chart=null`, `chartUuid=null`, `draftName='Untitled chart'`, `draftDescription=''`, default `chartConfig`, clear selections/results, `loading=false`, load project tree (no table yet).
- [x] **Step 4:** Template: show main shell when `chart() || isCreateMode()`; show FIELDS sidebar when `editMode() && (chart() || isCreateMode())`; breadcrumb current = `displayName()`; in create mode hide view-only Edit button path (already in edit); **Done** navigates to charts list instead of `exitEditMode`.
- [x] **Step 5:** Ensure table pick via PROJECT (`onProjectNodeSelected`) loads explore and works without an existing chart.

---

### Task 2: Create save + canSave + verify

**Files:**
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.html` (Save label if needed)

- [x] **Step 1:** Update `canSave` for create: `isCreateMode || chart`, explore, draftName (or allow empty until dialog), `canRenderChart`, not loading. Mirror tables-workspace: require a successful query render before create.
- [x] **Step 2:** Branch `saveChart()`: if create, open `SaveChartDialog` (suggested name from `draftName` or explore label), then `chartService.create(...)` with metricQuery/chartConfig/filters/description; on success navigate to `/projects/:id/charts/:uuid`. If edit, keep existing `update` path.
- [x] **Step 3:** Import `SaveChartDialog` / `MatDialog` if not already present on chart-view.
- [x] **Step 4:** Run a focused build or typecheck for `mds-ui` and fix errors.
- [x] **Step 5:** Self-review: create route no longer uses tables-workspace; list “Create chart” link still goes to `/charts/new`.

---

### Done when

- `/charts/new` shows the same edit shell as chart edit (sidebars + accordion).
- User can pick a table, fields, run chart, Save → lands on new chart UUID page.
- Existing `/charts/:uuid` edit/save unchanged.
