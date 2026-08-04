# Unified chart experience (chart-view + builder tabs)

## Goal

One saved-chart page that always shows builder-style **Filter / Chart / Results / SQL**, with an **Edit** mode for sidebars + metadata, and **Configure** that swaps the fields sidebar into chart-parameter mode.

## Assumptions

1. **Saved charts** use `chart-view-page` as the unified shell. **Create** (`/charts/new` → tables-workspace) stays separate for this slice.
2. Default mode is **view/browse**: accordion sections always visible; config/fields sidebars hidden; title/description read-only.
3. **Edit** reveals the collapsible config sidebar (fields by default), enables name/description editing, Save, and Done.
4. **Configure chart** (edit only) toggles the sidebar between Fields ↔ Configure panel — not a stacked dual panel.
5. Filters are editable in both modes (they live in the always-visible Filter section). Field picking requires Edit.
6. Mock API / fixtures unchanged. Filter state starts empty for charts whose `metricQuery.filters` is `{}`.

## Approaches considered

| Option | Summary | Trade-off |
|--------|---------|-----------|
| A. Redirect chart-view → tables-workspace | Reuse builder fully | Awkward for saved-chart metadata/save; folder tree noise |
| **B. Chart-view absorbs builder tabs** (chosen) | Keep chart route; add accordion + edit/configure modes | Incremental; create flow still separate |
| C. Full merge into one component | One page for create + edit | Large; out of scope for vertical slice |

## What the user sees

- **View:** Breadcrumbs, title/description, Edit, table badge; Filter / Chart / Results / SQL accordion.
- **Edit:** Same accordion + left sidebar (fields); editable name/description; Configure / Save / Done.
- **Configure (edit):** Sidebar shows chart type/layout/series/axes instead of fields; Close configure returns to fields.

## Vertical slice (this plan)

- [x] Mode signals: `editMode`, `configureMode`
- [x] Accordion: Filter, Chart, Results, SQL
- [x] Edit toggles sidebar; Configure swaps fields ↔ config
- [x] Name/description draft + save
- [x] Build verified (`ng build` development)
- [x] Later: fold create into same shell (see `2026-08-04-charts-new-unified-shell.md`)
- [ ] Later: sync metricQuery filters round-trip
