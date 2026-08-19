# Custom Model Joins (DB overlays) — Design

**Date:** 2026-08-19  
**Status:** Approved for implementation

## Problem

Table links between models are only available when declared in dbt `meta.joins`. Admins need to add, edit, and delete joins from the UI without changing dbt YAML, similar to dictionary overlays for descriptions.

## Goals

1. Persist custom joins per project in the database.
2. Merge custom joins with dbt meta joins when building explores (Charts field groups + SQL).
3. **Table Hub → Links tab:** filterable table of joins for the current model; Add/Edit dialog (source fixed).
4. **Project settings → Table links tab:** all project joins; filterable headers; Add/Edit dialog (source selectable).
5. dbt-defined joins are read-only; custom joins support Edit/Delete.

## Non-goals

- Inferring joins from SQL/lineage.
- Syncing custom joins back to dbt YAML.
- Warehouse-scoped links (links are project/dbt scoped).

## Data model

### `model_joins` table

| Column | Type | Notes |
|--------|------|-------|
| uuid | UUID PK | |
| project_uuid | UUID FK | CASCADE delete |
| source_dbt_unique_id | string | e.g. `model.test.fct_orders` |
| source_model_name | string | denormalized |
| source_column | string | |
| target_dbt_unique_id | string | |
| target_model_name | string | |
| target_column | string | |
| join_type | string | default `left` |
| relationship | string? | e.g. `many-to-one` |
| label | string? | |
| updated_at | datetime | |
| updated_by_user_uuid | UUID? | |

Generated `sql_on`: `${source_model_name.source_column} = ${target_model_name.target_column}`

### API list item (`ModelJoinView`)

```ts
type ModelJoinView = {
  uuid?: string;              // custom only
  sourceModelId: string;
  sourceModelName: string;
  sourceColumn: string;
  targetModelId: string;
  targetModelName: string;
  targetColumn: string;
  joinType: string;
  relationship?: string;
  label?: string;
  sqlOn: string;
  origin: 'dbt' | 'custom';
};
```

## Backend behavior

1. **CRUD** `GET/POST/PUT/DELETE /projects/{uuid}/model-joins` — custom joins only on write.
2. **List** returns merged dbt + custom joins for the project; optional `sourceModelId` query filter.
3. **Explore merge:** append custom joins to node joins before resolution; skip custom if dbt already declares same target model name.
4. Validate source/target models exist in lineage; columns exist on respective nodes.

## Frontend behavior

### Shared `LinkDialogComponent`

- Mode `hub`: source model locked; column/model search filters.
- Mode `project`: source model selectable with filter.
- Target model filter + columns filter on both sides.
- Preview `sqlOn`; join type, relationship, label fields.

### Shared `FilterableLinksTableComponent`

- Variant `hub`: columns Target model, Source column, Target column, Join, Relationship, Origin, Actions.
- Variant `project`: adds Source model column.
- Uses `app-content-list-column-header` for all filterable headers.

### Entry points

- Table Hub: new **Links** tab (`HubTab` includes `'links'`).
- Project edit: tabs **Configuration** | **Table links**.

## Testing

- Backend: CRUD, list merge, explore includes custom join, duplicate target skipped, invalid model/column 400.
- Frontend: component tests for filter + dialog validation (minimal).

## Success criteria

- Admin adds custom join in Table Hub; explore in Charts shows joined table fields.
- Project settings lists all links with working header filters.
- dbt joins visible but not editable/deletable.
