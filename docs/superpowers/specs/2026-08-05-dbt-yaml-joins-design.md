# dbt YAML Joins — Design

**Date:** 2026-08-05  
**Status:** Approved for implementation

## Problem

Explores always ship with `joinedTables: []`. Lightdash-style `meta.joins` in dbt YAML are ignored, so related models never appear as separate field groups in Explore.

## Goals

1. Parse Lightdash-compatible `meta.joins` from the dbt manifest when building an explore.
2. Best-effort resolution: never fail the explore request for bad join metadata.
3. Surface unresolved joins in the fields panel as visible, non-selectable table groups with a tooltip (including “Did you mean …?” when a close name exists).
4. Publish an LLM-ready markdown guide so an agent can add join YAML to a dbt project.

## Non-goals

- Fanout protection / relationship enforcement beyond storing `relationship`.
- Multiple named `explores` per model.
- Auto-inferring joins from SQL / lineage edges.
- Changing the left Tables/Explores tree (broken joins only affect the fields panel).
- Updating `mds-transform` YAML in this work (guide only).

## Data model

### Join declaration (dbt YAML → manifest)

Read joins from, in order of precedence (first non-empty wins):

1. `node.config.meta.joins`
2. `node.meta.joins`

Each join entry supports:

| Field | Required | Notes |
|-------|----------|--------|
| `join` | yes | Target model/source/seed name |
| `sql_on` | yes | Lightdash `${table.field}` syntax |
| `type` | no | `left` (default), `inner`, `right`, `full` |
| `label` | no | Display label for the joined table group |
| `relationship` | no | Stored; not enforced in v1 |
| `fields` | no | Whitelist of dimension/metric names from the joined table |

### Explore response additions

```ts
type ExploreJoinIssue = {
  table: string;           // declared join target name
  label?: string;          // declared label if any
  code: 'JOIN_TARGET_NOT_FOUND' | 'JOIN_MISSING_SQL_ON' | 'JOIN_INVALID';
  message: string;
  severity: 'warning' | 'error';
  suggestion?: string;     // closest model name when applicable
};

type Explore = {
  // existing fields...
  joinedTables: ExploreJoin[];
  tables: Record<string, CompiledTable>;
  joinIssues?: ExploreJoinIssue[];
};
```

Valid joins populate `joinedTables` and add a `CompiledTable` under `tables`.  
Invalid joins are omitted from `joinedTables` / `tables` and listed in `joinIssues`.

## Backend behavior

1. Attach raw `joins` (array or empty) onto each lineage node while building lineage (from manifest meta), so explore build does not need a second manifest pass.
2. Change explore build to accept the full lineage graph:
   - Build base table as today.
   - For each join: resolve target by `name` among lineage nodes.
   - On success: build joined `CompiledTable` (reuse existing dimension/metric heuristics; apply `fields` whitelist if present); append `ExploreJoin`.
   - On failure: append `ExploreJoinIssue` with severity `error` for missing target / missing `sql_on`, `warning` for other malformed entries; use `difflib.get_close_matches` for `suggestion`.
3. Update all callers of `build_explore_from_lineage_node` (semantic router, query router, tests) to pass lineage.

## Frontend behavior

1. Extend `Explore` / field-group types with `joinIssues`.
2. When building field groups for the fields panel:
   - Emit normal groups for each entry in `explore.tables` (base + valid joins).
   - Additionally emit one group per `joinIssue` with empty dimensions/metrics and an `issue` payload.
3. Fields panel: issue groups are greyed out, not clickable (no field toggles), with `matTooltip` showing `message` plus “Did you mean `suggestion`?” when present.

## Documentation

Add `docs/dbt-yaml-joins-for-llms.md` — self-contained prompt/guide covering:

- Why joins are declared in YAML (not inferred from SQL)
- Exact YAML shapes (dbt `meta` / `config.meta`)
- Field reference and examples for this repo’s models
- Checklist an LLM should follow when updating a dbt project
- How broken joins appear in the UI

## Testing

- Backend unit tests: valid join, missing target (+ suggestion), missing `sql_on`, fields whitelist, explore still returns 200 with base table.
- Frontend unit/component test: issue group renders disabled + tooltip text.

## Success criteria

- Explore with valid `meta.joins` shows multiple selectable table groups and compiles JOINs in SQL.
- Explore with a typo’d join target still loads; the bad target appears disabled with a helpful tooltip.
- An LLM can be given `docs/dbt-yaml-joins-for-llms.md` and produce correct YAML without further product context.
