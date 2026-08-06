# Chart kinds expansion (cartesian extras + ECharts-native)

**Date:** 2026-08-06  
**Status:** Accepted — implementation plan in `docs/superpowers/plans/2026-08-06-chart-kinds-expansion.md`  
**Scope:** Second chart-viz sub-project after the foundation (`2026-08-03-chart-viz-foundation-design.md`)  
**Related context:** Lightdash `ChartKind` / visualization config tabs; MDS UI ECharts host + subtab config panel

## Problem

The foundation ships six chart kinds (`vertical_bar`, `horizontal_bar`, `line`, `pie`, `table`, `big_number`) on a Lightdash-shaped `ChartType` / `ChartKind` / `ChartConfig` model with ECharts for cartesian + pie. Lightdash’s menu still includes kinds we do not render or offer: `area`, `scatter`, `mixed`, `funnel`, `treemap`, `gauge`, `sankey` (plus `map` / `custom` / `data_app_viz`, deferred).

Demo dashboards and saved charts use several of those kinds. Without them, the picker and mock catalog cannot exercise real Lightdash-like content.

## Goals

1. Add **area**, **scatter**, and **mixed** as cartesian kinds (same `ChartType: 'cartesian'` family).
2. Add **funnel**, **treemap**, **gauge**, and **sankey** as first-class families with configs + ECharts builders.
3. Expose all seven in the chart-type picker (explorer + chart view).
4. Reuse the **existing subtab shell** (Layout / Series / Axes / Display / Margins where applicable), inspired by Lightdash’s tabs but adapted to our Angular panel.
5. Ship **mock fixtures + query results** for each new kind so list / view / dashboard tiles are testable.
6. Keep config-cache-on-type-switch and `normalizeChartConfig` as the load/migrate path.

## Non-goals

- `map`, `custom`, `data_app_viz`
- Pixel-perfect Lightdash visual or panel parity
- Full Lightdash series editors (colors per series, dual axes, mark lines) beyond mixed type-per-Y
- Pivot UI / group-by series expansion
- Backend schema migrations beyond JSON `chartConfig` already stored
- Rewriting existing six kinds’ panel UX

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Approach | Extend the foundation (not per-kind silos, not literal Lightdash config port) |
| Cartesian extras | Same family; kind via `layout.cartesianKind`; mixed uses optional per-series `type` |
| New families | Activate reserved `ChartType`s: `funnel`, `treemap`, `gauge`, `sankey` |
| Panel depth | Same subtabs as today; Layout + Display (+ Margins) for non-cartesian families |
| Mixed | Cartesian kind; Series subtab sets `bar` / `line` / `area` per Y metric (not scatter) |
| Renderer | Existing ECharts host + pure option builders |
| Deferred | Map, custom, data app viz |

## Architecture

### Kind ↔ type mapping

| Kind | `ChartType` | Notes |
|------|-------------|--------|
| `vertical_bar`, `horizontal_bar`, `line`, `area`, `scatter`, `mixed` | `cartesian` | `horizontal_bar` keeps `flipAxes`; area/scatter/mixed set `cartesianKind` |
| `funnel` | `funnel` | New body |
| `treemap` | `treemap` | New body |
| `gauge` | `gauge` | New body |
| `sankey` | `sankey` | New body |
| existing | unchanged | pie / table / big_number |

`ACTIVE_CHART_TYPES` gains `funnel | treemap | gauge | sankey`. `chartTypeFromKind` / `chartKindFromConfig` / `applyChartKindChange` / `defaultConfigForType` are extended accordingly.

### Config shapes

**Cartesian (extended)** — keep `CartesianChartConfigBody`. Widen `layout.cartesianKind` to include `area | scatter | mixed`. Add optional:

```ts
series?: Array<{
  fieldId: FieldId;
  type: 'bar' | 'line' | 'area';
}>;
```

- `area` / `scatter`: builder defaults all Y series to that geometry when `series` is absent (`scatter` is kind-level only, not a mixed series type).
- `mixed`: synthesizes `series` from `yFields` when absent; missing entries default to `bar`; Series subtab edits type per metric (`bar` | `line` | `area` only).
- Kind detection: prefer explicit `layout.cartesianKind`; if kind is unset and series types differ → treat as `mixed`.

**Funnel**

- Layout: metric (or value field), optional category/label field, data orientation (`column` | `row`) inspired by Lightdash
- Display: legend/labels/margins subset we already use elsewhere

**Treemap**

- Layout: one or more dimension fields (hierarchy), one metric
- Display: labels, legend/margins as applicable

**Gauge**

- Layout: selected metric, optional min/max (defaults inferred or 0 / nice max)
- Display: show label, color thresholds (minimal: single primary color + optional ranges later)

**Sankey**

- Layout: `sourceField`, `targetField`, `weightField` (dimensions + metric)
- Display: node labels, margins

Unknown future types on load still normalize to `table` + non-blocking notice (foundation behavior).

### Rendering

| Family | Builder |
|--------|---------|
| cartesian (incl. area/scatter/mixed) | Extend `buildCartesianOption` |
| funnel | `buildFunnelOption` |
| treemap | `buildTreemapOption` |
| gauge | `buildGaugeOption` |
| sankey | `buildSankeyOption` |

`ChartVisualizationComponent` switches on `config.type`, calls the builder, feeds `EchartHostComponent`. Empty required fields or empty rows → no init / existing empty state. Builder exceptions → catch → empty state.

### Config panels

Reuse `tables-chart-config-panel` subtab pattern:

| Family | Subtabs |
|--------|---------|
| cartesian (all cartesian kinds) | Layout, Series, Axes, Display, Margins — Series shows type-per-metric controls only when kind is `mixed` |
| funnel / treemap / gauge / sankey | Layout + Display (+ Margins if the family stores margins) |

Field pickers bind to selected explore dimensions/metrics the same way as today. Sankey needs ≥2 dimensions + 1 metric before it can render.

### Data flow

Unchanged ownership: explorer and chart-view hold `chartConfig` + `cachedChartConfigs`. Type switch uses `applyChartKindChange`. Dashboard tiles consume saved `chartConfig` via the shared viz component — no tile API change.

Sync helpers: when fields become invalid after explore selection changes, clear or re-infer layout fields (cartesian X/Y; funnel/gauge metric; treemap dims+metric; sankey triple).

### Mocks

Add one saved chart fixture (+ mock query results) per new kind (`area`, `scatter`, `mixed`, `funnel`, `treemap`, `gauge`, `sankey`) so:

- Charts list shows the kinds
- Chart view renders with mock run results
- Optional: one dashboard tile referencing a new-kind chart for smoke

## Components & file map (expected)

| Area | Responsibility |
|------|----------------|
| `chart.model.ts` | Kinds, bodies, defaults, normalize |
| `chart-config.utils.ts` | Mapping, cache, panel view/patch |
| `tables-chart-config.constants.ts` + panel | Picker options + subtab content |
| `echarts/build-cartesian-option.ts` | Area / scatter / mixed |
| `echarts/build-{funnel,treemap,gauge,sankey}-option.ts` | New builders + specs |
| `chart-visualization` | Family switch |
| Fixtures / mock router | Seed charts + results |

## Edge cases

- Switching away from mixed and back restores series overrides via cartesian cache when possible.
- Sankey with cycles or missing nodes: builder filters invalid links; if none remain → empty state.
- Gauge with non-numeric metric: treat as empty.
- Funnel with one row: still render a single stage.
- Horizontal bar remains `flipAxes`; area/scatter ignore flip for series geometry (axes still respect layout flags).

## Testing

- Unit: `normalizeChartConfig` / kind↔type for each new kind; builder smoke tests (option `series`/`series.type` shapes).
- Manual (Chromium + Firefox): picker → each new kind; open each mock fixture; no horizontal page scroll.

## Implementation order (guidance for plan)

1. Model + utils + picker options for all seven kinds (defaults/normalize; render may still empty).
2. Cartesian builders + Series mixed controls + mocks for area/scatter/mixed.
3. Funnel / treemap / gauge / sankey builders + Layout/Display panels + mocks.
4. Wire explorer/chart-view field sync + empty states; smoke verify.

## Out of scope (later)

1. Map  
2. Custom / data app viz  
3. Deeper series styling, dual axes, conditional formatting parity with Lightdash  
4. Pie / big number / table depth already listed in the foundation “later” list  
