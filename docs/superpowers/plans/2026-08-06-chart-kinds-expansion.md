# Chart kinds expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add seven Lightdash chart kinds (`area`, `scatter`, `mixed`, `funnel`, `treemap`, `gauge`, `sankey`) to the MDS UI picker, configs, ECharts renderers, config subtabs, and mock fixtures.

**Architecture:** Extend the existing `ChartType` / `ChartKind` / `ChartConfig` foundation and ECharts host. Cartesian extras stay on `type: 'cartesian'` via `layout.cartesianKind` (+ optional `series[]` for mixed). Funnel / treemap / gauge / sankey become active families with dedicated config bodies and `build*Option` builders. Config panels keep the current MatTabs subtab shell, adapted from Lightdash’s Layout/Display pattern.

**Tech Stack:** Angular 19, TypeScript, ECharts 5.x, Jasmine/`ng test` (ChromeHeadless), existing mock fixtures + `buildMockQueryResults`.

**Spec:** `docs/superpowers/specs/2026-08-06-chart-kinds-expansion-design.md`

## Global Constraints

- Out of scope: `map`, `custom`, `data_app_viz`; pixel-perfect Lightdash parity; dual axes / mark lines / full series color editors.
- Mixed series types are `bar | line | area` only (not scatter).
- Series type-per-metric UI only when kind is `mixed`.
- Horizontal bar remains `flipAxes` on cartesian; area/scatter ignore flip for series geometry.
- Unknown future `ChartType` on load → `table` + notice (foundation behavior).
- Chromium + Firefox; no horizontal page scroll.
- Prefer TDD for model/utils/builders; commit after each task.
- Do not commit unrelated dirty workspace files (`.tmp/`, etc.).
- Work in `mds-ui/` unless a task says otherwise.

## File map

| File | Role |
|------|------|
| `mds-ui/src/app/core/models/chart.model.ts` | Widen `ChartKind`; family bodies; `ChartConfig` union; defaults; normalize |
| `mds-ui/src/app/core/models/chart.model.spec.ts` | Normalize tests for new kinds |
| `mds-ui/src/app/core/models/chart-config.utils.ts` | kind↔type, cache, panel view/patch (+ series, sankey, etc.) |
| `mds-ui/src/app/core/models/chart-config.utils.spec.ts` | Mapping / mixed / family patch tests |
| `mds-ui/src/app/features/charts/echarts/build-cartesian-option.ts` | area / scatter / mixed series geometry |
| `mds-ui/src/app/features/charts/echarts/build-cartesian-option.spec.ts` | Builder tests |
| `mds-ui/src/app/features/charts/echarts/build-funnel-option.ts` (+ `.spec.ts`) | Funnel builder |
| `mds-ui/src/app/features/charts/echarts/build-treemap-option.ts` (+ `.spec.ts`) | Treemap builder |
| `mds-ui/src/app/features/charts/echarts/build-gauge-option.ts` (+ `.spec.ts`) | Gauge builder |
| `mds-ui/src/app/features/charts/echarts/build-sankey-option.ts` (+ `.spec.ts`) | Sankey builder |
| `mds-ui/src/app/features/charts/chart-visualization/*` | Switch on new `ChartType`s |
| `mds-ui/src/app/features/explorer/tables-chart-config-panel/*` | Picker options + subtabs + mixed series UI |
| `mds-ui/src/app/features/explorer/tables-workspace-page/*` | Field sync / `canRender` for new kinds |
| `mds-ui/src/app/features/charts/chart-view-page/*` | Same sync / `canRender` |
| `mds-ui/src/app/core/mock/fixtures/ids.fixture.ts` | New chart UUIDs |
| `mds-ui/src/app/core/mock/fixtures/charts.fixture.ts` | Seven mock saved charts |

---

### Task 1: Chart model — kinds, family bodies, defaults, normalize

**Files:**
- Modify: `mds-ui/src/app/core/models/chart.model.ts`
- Modify: `mds-ui/src/app/core/models/chart.model.spec.ts`

**Interfaces:**
- Produces:
  - `ChartKind` includes `'area' | 'scatter' | 'mixed' | 'funnel' | 'treemap' | 'gauge' | 'sankey'` (plus existing six)
  - `CartesianSeriesType = 'bar' | 'line' | 'area'`
  - `CartesianSeriesConfig = { fieldId: FieldId; type: CartesianSeriesType }`
  - `CartesianLayoutConfig.cartesianKind` widened to include `area | scatter | mixed`
  - `CartesianChartConfigBody.series?: CartesianSeriesConfig[]`
  - `FunnelChartConfigBody`, `TreemapChartConfigBody`, `GaugeChartConfigBody`, `SankeyChartConfigBody`
  - `ChartConfig` union members for those four types
  - `ACTIVE_CHART_TYPES` includes `funnel | treemap | gauge | sankey`
  - `defaultConfigForType` returns real defaults for those four (not table)
  - `normalizeChartConfig` accepts new discriminated shapes and legacy `{ type: 'area' | ... }` when applicable

```typescript
export type CartesianSeriesType = 'bar' | 'line' | 'area';

export type CartesianSeriesConfig = {
  fieldId: FieldId;
  type: CartesianSeriesType;
};

export type FunnelChartConfigBody = {
  fieldId?: FieldId;
  labelFieldId?: FieldId;
  dataInput: 'column' | 'row';
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type TreemapChartConfigBody = {
  dimensionFieldIds: FieldId[];
  metricFieldId?: FieldId;
  showLegend: boolean;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type GaugeChartConfigBody = {
  selectedField?: FieldId;
  min?: number;
  max?: number;
  showLabel: boolean;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type SankeyChartConfigBody = {
  sourceFieldId?: FieldId;
  targetFieldId?: FieldId;
  weightFieldId?: FieldId;
  showNodeLabels: boolean;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};
```

- [ ] **Step 1: Write failing normalize / default tests**

Append to `chart.model.spec.ts`:

```typescript
it('returns funnel defaults from defaultConfigForType', () => {
  const result = defaultConfigForType('funnel');
  expect(result.type).toBe('funnel');
  if (result.type === 'funnel') {
    expect(result.config.dataInput).toBe('column');
  }
});

it('normalizes a funnel ChartConfig passthrough', () => {
  const result = normalizeChartConfig({
    type: 'funnel',
    config: {
      fieldId: 'orders_order_count',
      dataInput: 'column',
      showLegend: true,
      legendPlacement: 'chart',
      rowLimit: 500,
      margins: { top: 8, right: 8, bottom: 8, left: 8 },
    },
  });
  expect(result.type).toBe('funnel');
});

it('normalizes cartesian area kind with cartesianKind', () => {
  const result = normalizeChartConfig({
    type: 'cartesian',
    config: {
      layout: {
        xField: 'orders_order_date',
        yFields: ['orders_total_revenue'],
        cartesianKind: 'area',
        flipAxes: false,
        stackMode: 'none',
        showGridX: true,
        showGridY: true,
        showXAxis: true,
        showYAxis: true,
        xAxisLabel: '',
        yAxisLabel: '',
      },
      showLegend: true,
      legendPlacement: 'chart',
      rowLimit: 500,
      margins: { top: 8, right: 8, bottom: 8, left: 8 },
    },
  });
  expect(result.type).toBe('cartesian');
  if (result.type === 'cartesian') {
    expect(result.config.layout.cartesianKind).toBe('area');
  }
});
```

Import `defaultConfigForType` in the spec.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include=src/app/core/models/chart.model.spec.ts`  
Expected: FAIL (types / defaults missing)

- [ ] **Step 3: Implement model changes**

In `chart.model.ts`:
1. Widen `ChartKind`.
2. Add series + family body types (above).
3. Widen `CartesianLayoutConfig.cartesianKind` and add optional `series` on cartesian body.
4. Extend `ChartConfig` union with funnel/treemap/gauge/sankey.
5. Add `ACTIVE_CHART_TYPES` entries; implement `default*Config` helpers; update `defaultConfigForType` switch (keep `map`/`custom`/`data_app_viz` → table).
6. Update `normalizeChartConfig` to accept the new union members (passthrough merge with defaults). For legacy `{ type: 'area' | 'scatter' | 'mixed', xField, yFields, displayConfig }` migrate like other cartesian kinds.

Fix any TypeScript exhaustiveness errors in this file only (utils come in Task 2). If other files fail to compile because of incomplete switches, add temporary `default:` / assert branches only where required to keep the project compiling — prefer completing switches in Task 2.

- [ ] **Step 4: Run tests — expect PASS**

Same `ng test` command as Step 2. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/core/models/chart.model.ts mds-ui/src/app/core/models/chart.model.spec.ts
git commit -m "$(cat <<'EOF'
feat(charts): extend ChartKind/ChartConfig for seven new kinds

Add area/scatter/mixed cartesian fields and funnel/treemap/gauge/sankey family bodies with defaults and normalize support.
EOF
)"
```

---

### Task 2: chart-config utils — mapping, cache, panel adapters

**Files:**
- Modify: `mds-ui/src/app/core/models/chart-config.utils.ts`
- Modify: `mds-ui/src/app/core/models/chart-config.utils.spec.ts`

**Interfaces:**
- Consumes: Task 1 types / `defaultConfigForType`
- Produces:
  - `chartTypeFromKind` maps new kinds correctly
  - `chartKindFromConfig` returns `area|scatter|mixed|funnel|treemap|gauge|sankey`
  - `CartesianKind` includes `area|scatter|mixed`
  - `applyChartKindChange` works for all new kinds (cartesian stay on same type; others swap family)
  - `ChartPanelView` extended:

```typescript
export type ChartPanelView = {
  chartKind: ChartKind;
  xField: FieldId | null;
  yFields: FieldId[];
  displayConfig: ChartDisplayConfig;
  series?: CartesianSeriesConfig[];
  funnelDataInput?: 'column' | 'row';
  treemapDimensionFieldIds?: FieldId[];
  gaugeMin?: number;
  gaugeMax?: number;
  sankeySourceFieldId?: FieldId | null;
  sankeyTargetFieldId?: FieldId | null;
  sankeyWeightFieldId?: FieldId | null;
  showNodeLabels?: boolean;
  showGaugeLabel?: boolean;
};
```

  - `applyChartPanelPatch` accepts the same optional family fields on the patch object and writes them onto the active family body
  - When patching cartesian `yFields`, keep `series` in sync: drop removed fields; append missing as `{ fieldId, type: 'bar' }` if `cartesianKind === 'mixed'`

- [ ] **Step 1: Write failing utils tests**

```typescript
import {
  applyChartKindChange,
  applyChartPanelPatch,
  chartKindFromConfig,
  chartTypeFromKind,
  toChartPanelView,
} from './chart-config.utils';
import { defaultConfigForType } from './chart.model';

describe('chart kinds expansion utils', () => {
  it('maps area/scatter/mixed to cartesian', () => {
    expect(chartTypeFromKind('area')).toBe('cartesian');
    expect(chartTypeFromKind('scatter')).toBe('cartesian');
    expect(chartTypeFromKind('mixed')).toBe('cartesian');
    expect(chartTypeFromKind('funnel')).toBe('funnel');
    expect(chartTypeFromKind('sankey')).toBe('sankey');
  });

  it('applyChartKindChange sets cartesianKind for area', () => {
    const { chartConfig } = applyChartKindChange(
      defaultConfigForType('cartesian'),
      {},
      'area',
    );
    expect(chartKindFromConfig(chartConfig)).toBe('area');
  });

  it('applyChartKindChange switches to sankey family', () => {
    const { chartConfig, cache } = applyChartKindChange(
      defaultConfigForType('cartesian'),
      {},
      'sankey',
    );
    expect(chartConfig.type).toBe('sankey');
    expect(cache.cartesian?.type).toBe('cartesian');
  });

  it('panel patch updates sankey fields', () => {
    const patched = applyChartPanelPatch(defaultConfigForType('sankey'), {
      sankeySourceFieldId: 'orders_status',
      sankeyTargetFieldId: 'orders_city',
      sankeyWeightFieldId: 'orders_order_count',
    });
    expect(patched.type).toBe('sankey');
    if (patched.type === 'sankey') {
      expect(patched.config.sourceFieldId).toBe('orders_status');
      expect(patched.config.targetFieldId).toBe('orders_city');
      expect(patched.config.weightFieldId).toBe('orders_order_count');
    }
  });

  it('toChartPanelView exposes mixed series', () => {
    const config = defaultConfigForType('cartesian');
    if (config.type !== 'cartesian') throw new Error('expected cartesian');
    config.config.layout.cartesianKind = 'mixed';
    config.config.layout.yFields = ['m1', 'm2'];
    config.config.series = [
      { fieldId: 'm1', type: 'bar' },
      { fieldId: 'm2', type: 'line' },
    ];
    const view = toChartPanelView(config);
    expect(view.chartKind).toBe('mixed');
    expect(view.series).toEqual(config.config.series);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include=src/app/core/models/chart-config.utils.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement utils**

Update `CARTESIAN_KINDS` / `CartesianKind` / `flipAxesForCartesianKind` (`area|scatter|mixed` → `flipAxes: false` unless already set for mixed restore from cache).

Complete all switches on `ChartConfig['type']` in this file (displayConfig helpers, `toChartPanelView`, `applyChartPanelPatch`, `chartKindFromConfig`).

For `chartKindFromConfig` cartesian branch: return `layout.cartesianKind` when set; else existing flipAxes heuristic.

- [ ] **Step 4: Run tests — expect PASS**

Same command. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/core/models/chart-config.utils.ts mds-ui/src/app/core/models/chart-config.utils.spec.ts
git commit -m "$(cat <<'EOF'
feat(charts): map and patch new chart kinds in config utils

Wire kind↔type, kind change cache, and panel adapters for cartesian extras and ECharts-native families.
EOF
)"
```

---

### Task 3: Cartesian builder — area, scatter, mixed

**Files:**
- Modify: `mds-ui/src/app/features/charts/echarts/build-cartesian-option.ts`
- Modify: `mds-ui/src/app/features/charts/echarts/build-cartesian-option.spec.ts`
- Modify: `mds-ui/src/app/features/charts/chart-visualization/chart-visualization.component.ts`

**Interfaces:**
- Consumes: `CartesianChartConfigBody.series`, widened `ChartKind`
- Produces: `buildCartesianOption` accepts `chartKind: Extract<ChartKind, 'vertical_bar' | 'horizontal_bar' | 'line' | 'area' | 'scatter' | 'mixed'>`

Series geometry rules:
- Resolve per-field type: `config.series` entry → else kind default (`area`→area, `scatter`→scatter, `line`→line, bars→bar, `mixed`→bar)
- ECharts: `bar` → `type: 'bar'`; `line` → `type: 'line'`; `area` → `type: 'line'` + `areaStyle: {}`; `scatter` → `type: 'scatter'`
- Horizontal flip only when kind is `horizontal_bar` or `layout.flipAxes` (scatter/area still honor axis show/grid flags)

- [ ] **Step 1: Write failing builder tests**

```typescript
it('builds area series with areaStyle', () => {
  const option = buildCartesianOption({
    results,
    config: {
      ...config,
      layout: { ...config.layout, cartesianKind: 'area' },
    },
    chartKind: 'area',
  });
  const series = option?.series as Array<{ type?: string; areaStyle?: unknown }>;
  expect(series?.[0].type).toBe('line');
  expect(series?.[0].areaStyle).toBeTruthy();
});

it('builds scatter series', () => {
  const option = buildCartesianOption({
    results,
    config: {
      ...config,
      layout: { ...config.layout, cartesianKind: 'scatter' },
    },
    chartKind: 'scatter',
  });
  const series = option?.series as Array<{ type?: string }>;
  expect(series?.[0].type).toBe('scatter');
});

it('builds mixed series from config.series', () => {
  const option = buildCartesianOption({
    results: {
      ...results,
      metricQuery: {
        ...results.metricQuery,
        metrics: ['orders_total', 'orders_count'],
      },
      fields: {
        ...results.fields,
        orders_count: {
          ...results.fields.orders_total,
          fieldId: 'orders_count',
          name: 'count',
          label: 'Count',
        },
      },
      rows: results.rows.map((row) => ({
        ...row,
        orders_count: { value: { raw: 5, formatted: '5' } },
      })),
    },
    config: {
      ...config,
      layout: {
        ...config.layout,
        cartesianKind: 'mixed',
        yFields: ['orders_total', 'orders_count'],
      },
      series: [
        { fieldId: 'orders_total', type: 'bar' },
        { fieldId: 'orders_count', type: 'line' },
      ],
    },
    chartKind: 'mixed',
  });
  const series = option?.series as Array<{ type?: string }>;
  expect(series?.map((s) => s.type)).toEqual(['bar', 'line']);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include=src/app/features/charts/echarts/build-cartesian-option.spec.ts`  
Expected: FAIL

- [ ] **Step 3: Implement builder + viz kind allow-list**

Update `BuildCartesianArgs['chartKind']` and series construction. Update `chart-visualization.component.ts` `echartsOption` cartesian branch to allow `area|scatter|mixed` (not only bar/line).

- [ ] **Step 4: Run tests — expect PASS**

Same command. Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/charts/echarts/build-cartesian-option.ts mds-ui/src/app/features/charts/echarts/build-cartesian-option.spec.ts mds-ui/src/app/features/charts/chart-visualization/chart-visualization.component.ts
git commit -m "$(cat <<'EOF'
feat(charts): render area, scatter, and mixed cartesian series

Extend the ECharts cartesian builder and visualization host allow-list for the new cartesian kinds.
EOF
)"
```

---

### Task 4: Picker + mixed Series subtab UI

**Files:**
- Modify: `mds-ui/src/app/features/explorer/tables-chart-config-panel/tables-chart-config.constants.ts`
- Modify: `mds-ui/src/app/features/explorer/tables-chart-config-panel/tables-chart-config-panel.component.ts`
- Modify: `mds-ui/src/app/features/explorer/tables-chart-config-panel/tables-chart-config-panel.component.html`
- Modify: `mds-ui/src/app/features/explorer/tables-chart-config-panel/tables-chart-config-panel.component.spec.ts` (if present patterns exist; else add focused tests)
- Modify callers if panel API grows: `tables-workspace-page.component.*`, `chart-view-page.component.*`

**Interfaces:**
- Produces:
  - `TABLES_CHART_TYPE_OPTIONS` includes the seven new kinds with Material icons (`area_chart`, `scatter_plot`, `multiline_chart`, `filter_alt`, `grid_view`, `speed`, `account_tree` — pick closest available Material icons)
  - `isCartesianChart` true for `area|scatter|mixed` as well
  - New section constants:

```typescript
export const FUNNEL_CONFIG_SECTIONS = [
  { id: 'layout', label: 'Layout' },
  { id: 'display', label: 'Display' },
] as const;
// same Layout+Display for TREEMAP, GAUGE, SANKEY
```

  - Panel inputs: `series` optional; outputs: `seriesChange`
  - When `chartKind === 'mixed'`, Series subtab shows a select per Y metric: Bar / Line / Area
  - Layout+Display shells for funnel/treemap/gauge/sankey (field binding in Task 5–8 as each family lands — this task at least adds picker entries + cartesian mixed UI + empty Layout/Display stubs that no-op until family inputs exist)

Minimal for this task: picker + cartesian detection + mixed series controls wired through existing parent patch path.

Parents must pass `series` from `toChartPanelView` and on `seriesChange` call `applyChartPanelPatch(config, { series })`.

- [ ] **Step 1: Write / extend panel spec for mixed series emit**

In `tables-chart-config-panel.component.spec.ts`, add a test that with `chartKind: 'mixed'` and two y fields, changing a select emits `seriesChange` with updated types. If the spec harness is heavy, a shallow unit on a small helper `updateSeriesType(series, fieldId, type)` in the component file (or utils) is acceptable — prefer testing the helper if component fixture setup is painful.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include=src/app/features/explorer/tables-chart-config-panel/tables-chart-config-panel.component.spec.ts`

- [ ] **Step 3: Implement picker + mixed UI + parent wiring**

Update constants, component TS/HTML, and both parents’ bindings for `series` / `seriesChange`.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/explorer/tables-chart-config-panel mds-ui/src/app/features/explorer/tables-workspace-page mds-ui/src/app/features/charts/chart-view-page
git commit -m "$(cat <<'EOF'
feat(charts): add new kinds to picker and mixed series controls

Expose area/scatter/mixed/funnel/treemap/gauge/sankey in the type menu and allow per-metric bar/line/area for mixed charts.
EOF
)"
```

---

### Task 5: Funnel — builder, viz, panel layout/display

**Files:**
- Create: `mds-ui/src/app/features/charts/echarts/build-funnel-option.ts`
- Create: `mds-ui/src/app/features/charts/echarts/build-funnel-option.spec.ts`
- Modify: `chart-visualization.component.ts` (+ html only if needed)
- Modify: config panel for funnel Layout/Display (field = metric or value; optional label field; dataInput; legend/margins)
- Modify: parents to sync funnel fields via `applyChartPanelPatch` (`yFields[0]` → `fieldId`, optional `xField` → `labelFieldId`, `funnelDataInput`)

**Interfaces:**
- Produces: `buildFunnelOption({ results, config }): EChartsOption | null`
- Required: `config.fieldId` present and in results; ≥1 row
- ECharts `series: [{ type: 'funnel', data: [...] }]` using formatted labels

- [ ] **Step 1: Write failing builder test**

```typescript
import { buildFunnelOption } from './build-funnel-option';
import { FunnelChartConfigBody } from '../../../core/models/chart.model';
// reuse a small QueryResults fixture similar to cartesian spec

it('builds funnel series from fieldId', () => {
  const config: FunnelChartConfigBody = {
    fieldId: 'orders_total',
    labelFieldId: 'orders_status',
    dataInput: 'column',
    showLegend: true,
    legendPlacement: 'chart',
    rowLimit: 500,
    margins: { top: 8, right: 8, bottom: 8, left: 8 },
  };
  const option = buildFunnelOption({ results, config });
  const series = option?.series as Array<{ type?: string; data?: unknown[] }>;
  expect(series?.[0].type).toBe('funnel');
  expect(series?.[0].data?.length).toBe(2);
});
```

- [ ] **Step 2: Run — expect FAIL**

`ng test --include=src/app/features/charts/echarts/build-funnel-option.spec.ts`

- [ ] **Step 3: Implement builder + viz switch + panel fields**

`chart-visualization`: `if (config.type === 'funnel') return buildFunnelOption(...)`.

Panel: when `chartKind === 'funnel'`, show Layout (metric select, optional label/dimension, orientation) + Display (legend, margins). Wire patches.

Update `canRenderChart` in explorer + chart-view: funnel needs `fieldId` / yFields[0].

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(charts): add funnel chart builder and config panel

Render funnel charts via ECharts and expose Layout/Display settings in the existing subtab shell.
EOF
)"
```

---

### Task 6: Treemap — builder, viz, panel

**Files:**
- Create: `build-treemap-option.ts` + `.spec.ts`
- Modify: viz host, config panel, parents

**Interfaces:**
- `buildTreemapOption({ results, config }): EChartsOption | null`
- Requires `metricFieldId` and ≥1 `dimensionFieldIds`
- Build hierarchical `data` tree from rows (single dimension → flat leaf list under root; two+ dims → nested)

- [ ] **Step 1: Failing test** — series type `treemap`, non-empty data  
- [ ] **Step 2: Run — FAIL**  
- [ ] **Step 3: Implement builder + viz + Layout (dimensions multi-select / ordered list + metric) + Display**  
- [ ] **Step 4: Run — PASS**  
- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(charts): add treemap chart builder and config panel

Support hierarchical treemap rendering and Layout/Display configuration.
EOF
)"
```

---

### Task 7: Gauge — builder, viz, panel

**Files:**
- Create: `build-gauge-option.ts` + `.spec.ts`
- Modify: viz host, config panel, parents

**Interfaces:**
- `buildGaugeOption({ results, config }): EChartsOption | null`
- Value = first row `selectedField` numeric raw
- `min` default 0; `max` default `Math.max(value * 1.25, value, 1)` when unset
- ECharts `series: [{ type: 'gauge', ... }]`

- [ ] **Step 1: Failing test** — gauge series + detail value  
- [ ] **Step 2: Run — FAIL**  
- [ ] **Step 3: Implement builder + viz + Layout (metric, min, max) + Display (showLabel, margins)**  
- [ ] **Step 4: Run — PASS**  
- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(charts): add gauge chart builder and config panel

Render single-metric gauges with optional min/max and label display settings.
EOF
)"
```

---

### Task 8: Sankey — builder, viz, panel

**Files:**
- Create: `build-sankey-option.ts` + `.spec.ts`
- Modify: viz host, config panel, parents

**Interfaces:**
- `buildSankeyOption({ results, config }): EChartsOption | null`
- Requires `sourceFieldId`, `targetFieldId`, `weightFieldId`
- Aggregate rows into links `{ source, target, value }`; build unique `nodes: [{ name }]`
- Skip links where source === target or value ≤ 0; return null if no links remain

- [ ] **Step 1: Failing test** with 2+ rows → nodes + links  
- [ ] **Step 2: Run — FAIL**  
- [ ] **Step 3: Implement builder + viz + Layout (source/target/weight selects) + Display (showNodeLabels, margins)**  
- [ ] **Step 4: Run — PASS**  
- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(charts): add sankey chart builder and config panel

Render source/target/weight sankey diagrams and expose field mapping in Layout.
EOF
)"
```

---

### Task 9: Mock fixtures for all seven kinds

**Files:**
- Modify: `mds-ui/src/app/core/mock/fixtures/ids.fixture.ts`
- Modify: `mds-ui/src/app/core/mock/fixtures/charts.fixture.ts`
- Modify: `mds-ui/src/app/core/mock/fixtures/index.fixture.ts` only if charts must be listed for home/pinned content

**Interfaces:**
- Add `MOCK_CHART_9_UUID` … `MOCK_CHART_15_UUID` (or next free ids after 8)
- Seven `mockSavedChartDetails` entries:

| Kind | Suggested name | Explore fields |
|------|----------------|----------------|
| area | Revenue area | order_date × total_revenue |
| scatter | Partner profit scatter | use two numeric metrics if available, else date × revenue |
| mixed | Revenue vs orders mixed | order_date × total_revenue + order_count with series bar/line |
| funnel | Status funnel | status label + order_count |
| treemap | Revenue treemap | status (+ optional city) × total_revenue |
| gauge | Order count gauge | order_count |
| sankey | Status to city flow | status → city weighted by order_count |

Use existing `normalizeChartConfig` / typed configs. Rely on `buildMockQueryResults` for run data (no special fixture rows required unless sankey/treemap need extra dimensions already present on `orders` explore).

- [ ] **Step 1: Add UUIDs + chart detail objects + list derivation** (list already maps `Object.values`)  
- [ ] **Step 2: Smoke via mock — open charts list in app OR unit-assert `mockSavedChartsList` contains the seven kinds**

```typescript
// optional small fixture test or assert in an existing mock test file
expect(mockSavedChartsList.map((c) => c.chartKind)).toEqual(
  jasmine.arrayContaining(['area', 'scatter', 'mixed', 'funnel', 'treemap', 'gauge', 'sankey']),
);
```

If no mock fixture test file exists, add `charts.fixture.spec.ts` with that assertion.

- [ ] **Step 3: Run test / manual mock list check**  
- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
test(charts): add mock saved charts for seven new kinds

Seed area, scatter, mixed, funnel, treemap, gauge, and sankey fixtures for UI testing.
EOF
)"
```

---

### Task 10: Field sync + canRender hardening + smoke

**Files:**
- Modify: `tables-workspace-page.component.ts`
- Modify: `chart-view-page.component.ts`
- Optionally: `dashboard-chart-tile` if it special-cases kinds (should already pass `chartConfig` through)

**Requirements:**
- `canRenderChart` / equivalent:
  - cartesian (incl. area/scatter/mixed): x + ≥1 y
  - funnel: fieldId
  - treemap: ≥1 dimension + metric
  - gauge: selectedField
  - sankey: source + target + weight
- On selection change, sync layout fields for new families (mirror `syncChartAxisFields` / `ensureBigNumberMetric` patterns):
  - funnel: set `fieldId` from first metric
  - gauge: set `selectedField`
  - treemap: dimensions from selected dims, metric from first metric
  - sankey: source/target from first two dims, weight from first metric when unset/invalid

- [ ] **Step 1: Add/adjust unit tests if pages have specs; otherwise manual checklist below**  
- [ ] **Step 2: Implement sync + canRender**  
- [ ] **Step 3: Manual smoke (Chromium + Firefox)**

Checklist:
1. Charts list shows seven new mock charts
2. Open each mock — viz renders (not empty) under mock API
3. Explorer: switch picker through all new kinds; Layout/Display subtabs appear; mixed Series type selects work
4. No horizontal page scroll on chart view / explorer

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
feat(charts): sync explore fields for new chart families

Infer funnel/treemap/gauge/sankey layout fields from selection and gate rendering on required mappings.
EOF
)"
```

- [ ] **Step 5: Update spec status**

Set `docs/superpowers/specs/2026-08-06-chart-kinds-expansion-design.md` status to `Accepted — implementation plan in docs/superpowers/plans/2026-08-06-chart-kinds-expansion.md` and commit:

```bash
git add docs/superpowers/specs/2026-08-06-chart-kinds-expansion-design.md
git commit -m "docs: mark chart kinds expansion spec accepted"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| area/scatter/mixed cartesian | 1–4 |
| funnel/treemap/gauge/sankey families | 1–2, 5–8 |
| Picker exposure | 4 |
| Same subtab shell | 4–8 |
| Mock fixtures | 9 |
| Config cache / normalize | 1–2 |
| No map/custom/data_app_viz | Global constraints |
| Mixed bar/line/area only | Tasks 1–4 |
| Field sync / empty states | 5–8, 10 |
| Chromium + Firefox smoke | 10 |

No TBD placeholders. Types named consistently (`FunnelChartConfigBody`, `CartesianSeriesConfig`, `buildFunnelOption`, etc.).
