# Custom Model Joins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Allow admins to create, edit, and delete custom table joins stored in the database, merged with dbt meta joins at explore time, with filterable UI on Table Hub and Project settings.

**Architecture:** New `model_joins` table + CRUD API; `build_explore_with_join_overlays` merges custom joins into explore build; shared Angular `FilterableLinksTableComponent` and `LinkDialogComponent`.

**Spec:** `docs/superpowers/specs/2026-08-19-custom-model-joins-design.md`

## Global Constraints

- Custom joins merge with dbt joins; dbt target names take precedence (custom skipped on duplicate target).
- dbt joins read-only in UI; custom joins editable.
- Lightdash `sql_on` format: `${model.column} = ${model.column}`.
- Filterable headers on both Table Hub Links tab and Project settings Table links tab.
- Hub dialog: source model locked; project dialog: source selectable with filters.

---

### Task 1: Backend persistence + API + explore merge ✅

**Files:** `mds-backend/src/mds/db/models.py`, `services/model_joins.py`, `routers/model_joins.py`, `services/dbt/parse.py`, routers semantic/query/exports, tests.

### Task 2: Frontend shared components ✅

**Files:** `model-join.model.ts`, `model-joins.service.ts`, `model-links.utils.ts`, `filterable-links-table/*`, `link-dialog/*`.

### Task 3: Table Hub Links tab ✅

**Files:** `table-hub-page.component.*`

### Task 4: Project settings Table links tab ✅

**Files:** `project-edit-page.component.*`
