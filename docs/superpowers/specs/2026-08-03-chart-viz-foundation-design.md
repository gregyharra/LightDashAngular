# Chart visualization foundation (ECharts + typed configs)

**Date:** 2026-08-03  
**Status:** Draft — awaiting user review  
**Scope:** First sub-project toward full Lightdash-like chart parity  
**Related context:** Lightdash `packages/common` `ChartType`/`ChartKind`/`ChartConfig`; current MDS UI `ChartKind` + flat `ChartDisplayConfig` + Chart.js

## Problem

The explorer and chart view support six chart kinds (`vertical_bar`, `horizontal_bar`, `line`, `pie`, `table`, `big_number`) with a flat shared `ChartDisplayConfig` and Chart.js rendering. That model cannot grow cleanly to Lightdash’s full menu (area, scatter, funnel, treemap, gauge, sankey, map, custom, data app viz): configs collide, type switches lose settings, and Chart.js cannot express several of those visuals well.

We need a foundation that matches Lightdash’s architecture shape so later chart families plug in without another schema break, while keeping today’s config panel UX for the existing six kinds.

## Goals

1. Replace Chart.js on the chart rendering path with **ECharts** (D3 may replace the option→DOM layer later; builders stay pure).
2. Introduce **`ChartType` (family)** + **`ChartKind` (menu/list label)** and a **discriminated `ChartConfig`** union.
3. **Cache** per-family configs when switching type so settings are not wiped.
4. Migrate the existing six kinds onto the new model with **roughly the same config panel** (no Lightdash multi-tab overhaul in this project).
5. Load **legacy** saved/fixture payloads via `normalizeChartConfig()`.
6. Reserve union members / enums for future families so storage does not reshape again.

## Non-goals

- New chart kinds in the menu (area, scatter, funnel, treemap, gauge, sankey, map, custom, data app viz)
- Lightdash-style multi-tab config panels (Layout / Series / Axes / Display / Margins as separate tabs)
- Series-level editors, mixed cartesian series, pivot UI
- Map (Leaflet) or Vega-Lite custom viz
- Pixel-perfect Lightdash visual parity
- Backend chart-type DB migrations beyond what the mock/API already persist as JSON

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Long-term chart set | All Lightdash menu families (later sub-projects) |
| Renderer | ECharts now; D3 possible later behind the same contracts |
| Foundation depth | Architecture + parity render; keep current panel UX |
| Model | Lightdash-shaped `ChartType` + `ChartKind` + discriminated config |

## Later sub-projects (out of this spec)

1. Cartesian depth (area, scatter, mixed, richer tabs)  
2. Pie / big number / table depth (comparison, conditional formatting, etc.)  
3. ECharts-native charts (funnel, treemap, gauge, sankey)  
4. Map  
5. Custom / data app viz  

## Architecture

### Type model

- **`ChartType`** — stored/rendered family:  
  `cartesian | pie | table | big_number` (active)  
  reserved: `funnel | treemap | gauge | sankey | map | custom | data_app_viz`
- **`ChartKind`** — UI label: keep existing kinds; later add `area | scatter | …`
- **`ChartConfig`** — `{ type: ChartType; config?: FamilyConfig }` discriminated union

**Cartesian config (v1)** — enough to express current bar / horizontal bar / line behavior:

- Layout: `xField`, `yFields`, `flipAxes`, `stackMode`, show grid/axis flags, axis labels  
- Display subset already exposed: legend, placement, margins, `seriesColor`, `showValueLabels`, `rowLimit` as used today  

Horizontal bar vs vertical bar is a **kind** change on the same `cartesian` config (`flipAxes`), not a `ChartType` switch (avoids wiping the cache).

**Pie / table / big_number (v1)** — migrate fields those kinds already use out of the flat `displayConfig` into family-specific configs (plus only the display bits they need).

### Helpers

- `chartTypeFromKind` / `chartKindFromConfig`  
- `getValidChartConfig(type, cache, incoming?)` — prefer incoming → cache → defaults  
- `normalizeChartConfig(raw)` — legacy `{ type: ChartKind; xField; yFields; displayConfig }` → new union  
- Page-level `cachedChartConfigs: Partial<Record<ChartType, { chartConfig }>>` on type switch  

No Redux/Explorer-store clone; keep Angular signal ownership on explorer and chart-view pages.

### Rendering

- `chart-visualization` host: resolve family → builder → ECharts host (cartesian, pie) or dedicated UI (table, big number — HTML, not ECharts)  
- Pure builders: `buildCartesianOption`, `buildPieOption`  
- Thin Angular wrapper: init / `setOption` / resize / dispose  
- Contract for a future D3 swap: replace host + builders only; configs unchanged  

### Persistence

- All load paths (API, mock, fixtures) run `normalizeChartConfig`  
- Save paths write the new shape only  
- Update fixtures and mock router accordingly  

## Components & data flow

| Piece | Responsibility |
|-------|----------------|
| `chart.model.ts` | Types, defaults, `normalizeChartConfig` |
| `chart-config.utils.ts` | Cache helpers, kind↔type mapping, `getValidChartConfig` |
| `tables-chart-config-panel` | Same UX; patches active family config (adapters OK for gradual call-site updates) |
| `chart-visualization` | Family switch + empty/error states |
| `echarts/` builders | Results + config → `EChartsOption` |
| ECharts directive/component | Lifecycle + resize |

**Type change:** map kind → type (+ cartesian flags) → save previous family to cache → `getValidChartConfig` → rebind panel + viz.  

**Config tweak:** panel patch → merge into `chartConfig.config` → recompute options via `setOption`.

## Edge cases & errors

- Missing x/y (or metric for big number) → empty state; do not init ECharts  
- Empty cache on type switch → family defaults; prefer inferring x/y from query dims/metrics when possible  
- Unknown future `ChartType` on load → treat as `table` with a non-blocking notice in the viz host; never crash  
- Builder failure → catch in host, show suboptimal empty state  
- Query errors: existing UI unchanged  
- Dashboard/explorer resize → ECharts `resize`; dispose on destroy  

## Testing

- Unit: `normalizeChartConfig`, kind↔type mapping, cache restore via `getValidChartConfig`  
- Unit: cartesian/pie builders with fixture rows (option shape smoke tests)  
- Update panel / workspace / chart-view specs for new config shapes  
- Manual smoke (Chromium + Firefox): all six kinds in explorer and chart view  

## Done when

- [ ] Chart.js is gone from the chart rendering path  
- [ ] Six kinds render (cartesian via ECharts; pie via ECharts; table / big number as structured UIs)  
- [ ] Type switch caches and restores family configs  
- [ ] Legacy fixtures/API payloads load through `normalizeChartConfig`  
- [ ] Reserved `ChartType` values exist in the union/enums without UI entries  

## Open follow-ups (explicitly deferred)

- ngx-echarts vs raw `echarts` wrapper — choose at implementation plan time; prefer smallest Angular-friendly wrapper  
- Exact JSON field names for family configs — mirror Lightdash where practical for later porting, but v1 may stay slimmer than Lightdash’s full cartesian `eChartsConfig.series` model  
