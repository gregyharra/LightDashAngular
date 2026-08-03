# Chart visualization foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Lightdash-shaped `ChartType`/`ChartKind`/`ChartConfig`, config cache on type switch, migrate Chart.js → ECharts for cartesian + pie, keep today’s config panel UX for the six existing kinds.

**Architecture:** Discriminated `ChartConfig` stored on explorer/chart-view/dashboard signals; `normalizeChartConfig` on load; panel keeps working via view adapters (`toChartPanelView` / `applyChartPanelPatch`); `ChartVisualizationComponent` hosts ECharts via a thin Angular wrapper and pure option builders. Table and big number stay HTML.

**Tech Stack:** Angular 19, TypeScript, ECharts 5.x (`echarts` package, raw wrapper — no ngx-echarts), Jasmine/`ng test`, existing mock fixtures + FastAPI JSON `chartConfig`.

**Spec:** `docs/superpowers/specs/2026-08-03-chart-viz-foundation-design.md`

## Global Constraints

- No new chart kinds in the menu (no area/scatter/funnel/treemap/gauge/sankey/map/custom).
- No Lightdash multi-tab config panel rewrite — keep current panel UX.
- Horizontal bar ↔ vertical bar is `flipAxes` on the same `cartesian` config (not a `ChartType` switch).
- Table and big number are HTML UIs, not ECharts.
- Unknown future `ChartType` on load → treat as `table` with a non-blocking notice.
- Chromium + Firefox; no horizontal page scroll.
- Prefer TDD for utils/builders; commit after each task.
- Do not commit unrelated dirty workspace files (auth, navbar, etc.).

## File map

| File | Role |
|------|------|
| `mds-ui/src/app/core/models/chart.model.ts` | `ChartType`, family configs, new `ChartConfig` union, keep `ChartKind`, `normalizeChartConfig`, defaults |
| `mds-ui/src/app/core/models/chart-config.utils.ts` | kind↔type, cache helpers, panel view adapters |
| `mds-ui/src/app/core/models/chart.model.spec.ts` | Normalize tests |
| `mds-ui/src/app/core/models/chart-config.utils.spec.ts` | Utils tests |
| `mds-ui/src/app/features/charts/echarts/echart-host.component.ts` | init / setOption / resize / dispose |
| `mds-ui/src/app/features/charts/echarts/build-cartesian-option.ts` | Cartesian → `EChartsOption` |
| `mds-ui/src/app/features/charts/echarts/build-pie-option.ts` | Pie → `EChartsOption` |
| `mds-ui/src/app/features/charts/echarts/*.spec.ts` | Builder smoke tests |
| `mds-ui/src/app/features/charts/chart-visualization/*` | Switch on `ChartType`, use host + builders |
| Explorer / chart-view / dashboard tile | Own `chartConfig` + `cachedChartConfigs` |
| Fixtures, mock API, backend seed/tests | New JSON shape (legacy still normalized) |

---

### Task 1: Chart model + `normalizeChartConfig`

**Files:**
- Modify: `mds-ui/src/app/core/models/chart.model.ts`
- Create: `mds-ui/src/app/core/models/chart.model.spec.ts`

**Interfaces:**
- Produces:
  - `ChartType = 'cartesian' | 'pie' | 'table' | 'big_number' | 'funnel' | 'treemap' | 'gauge' | 'sankey' | 'map' | 'custom' | 'data_app_viz'`
  - `ChartKind` unchanged for existing six kinds
  - `CartesianChartConfigBody` with `layout` + display fields used today
  - `PieChartConfigBody`, `TableChartConfigBody`, `BigNumberChartConfigBody`
  - `ChartConfig` discriminated union `{ type; config }`
  - `normalizeChartConfig(raw: unknown): ChartConfig`
  - `defaultConfigForType(type: ChartType): ChartConfig`
  - Keep exporting `ChartDisplayConfig` / `DEFAULT_CHART_DISPLAY_CONFIG` for panel view + shared display bits

- [ ] **Step 1: Write failing normalize tests**

```typescript
// mds-ui/src/app/core/models/chart.model.spec.ts
import { normalizeChartConfig } from './chart.model';

describe('normalizeChartConfig', () => {
  it('migrates legacy line chart to cartesian', () => {
    const result = normalizeChartConfig({
      type: 'line',
      xField: 'orders_order_date',
      yField: 'orders_total_revenue',
      displayConfig: { seriesColor: '#e67700', showValueLabels: true },
    });
    expect(result.type).toBe('cartesian');
    expect(result.config?.layout.xField).toBe('orders_order_date');
    expect(result.config?.layout.yFields).toEqual(['orders_total_revenue']);
    expect(result.config?.seriesColor).toBe('#e67700');
    expect(result.config?.showValueLabels).toBe(true);
  });

  it('migrates horizontal_bar with flipAxes', () => {
    const result = normalizeChartConfig({
      type: 'horizontal_bar',
      xField: 'a',
      yFields: ['b'],
      displayConfig: { flipAxes: true },
    });
    expect(result.type).toBe('cartesian');
    expect(result.config?.layout.flipAxes).toBe(true);
  });

  it('passes through already-normalized cartesian', () => {
    const input = {
      type: 'cartesian' as const,
      config: {
        layout: {
          xField: 'a',
          yFields: ['b'],
          flipAxes: false,
          stackMode: 'none' as const,
          showGridX: true,
          showGridY: true,
          showXAxis: true,
          showYAxis: true,
          xAxisLabel: '',
          yAxisLabel: '',
        },
        showLegend: true,
        legendPlacement: 'chart' as const,
        rowLimit: 500,
        margins: { top: 8, right: 8, bottom: 8, left: 8 },
      },
    };
    expect(normalizeChartConfig(input)).toEqual(input);
  });

  it('falls unknown future type back to table', () => {
    const result = normalizeChartConfig({ type: 'sankey', config: {} });
    expect(result.type).toBe('table');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include=src/app/core/models/chart.model.spec.ts`

Expected: FAIL (`normalizeChartConfig` missing or wrong shape)

- [ ] **Step 3: Implement types + normalize in `chart.model.ts`**

Replace the old flat `ChartConfig` with:

```typescript
export type ChartType =
  | 'cartesian'
  | 'pie'
  | 'table'
  | 'big_number'
  | 'funnel'
  | 'treemap'
  | 'gauge'
  | 'sankey'
  | 'map'
  | 'custom'
  | 'data_app_viz';

export type ChartKind =
  | 'vertical_bar'
  | 'horizontal_bar'
  | 'line'
  | 'pie'
  | 'table'
  | 'big_number';

/** Shared display fields still edited by today’s panel */
export type ChartDisplayConfig = {
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  showGridX: boolean;
  showGridY: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
  flipAxes: boolean;
  stackMode: ChartStackMode;
  rowLimit: number;
  margins: { top: number; right: number; bottom: number; left: number };
  showTableNames: boolean;
  showColumnTotals: boolean;
  seriesColor?: string;
  showValueLabels?: boolean;
};

export type CartesianLayoutConfig = {
  xField?: FieldId;
  yFields?: FieldId[];
  flipAxes: boolean;
  stackMode: ChartStackMode;
  showGridX: boolean;
  showGridY: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
};

export type CartesianChartConfigBody = {
  layout: CartesianLayoutConfig;
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
  seriesColor?: string;
  showValueLabels?: boolean;
};

export type PieChartConfigBody = {
  xField?: FieldId;
  yField?: FieldId;
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type TableChartConfigBody = {
  showTableNames: boolean;
  showColumnTotals: boolean;
  rowLimit: number;
};

export type BigNumberChartConfigBody = {
  selectedField?: FieldId;
  rowLimit: number;
};

export type ChartConfig =
  | { type: 'cartesian'; config: CartesianChartConfigBody }
  | { type: 'pie'; config: PieChartConfigBody }
  | { type: 'table'; config: TableChartConfigBody }
  | { type: 'big_number'; config: BigNumberChartConfigBody };

export function defaultConfigForType(type: ChartType): ChartConfig { /* active families only; reserved → table */ }

export function normalizeChartConfig(raw: unknown): ChartConfig {
  // 1) null/invalid → default cartesian
  // 2) if already family shape → merge defaults and return
  // 3) if legacy ChartKind → map to family
  // 4) reserved future types → table default
}
```

Preserve `DEFAULT_CHART_DISPLAY_CONFIG`. Update `SavedChart.chartConfig` to the new union. Keep `chartKind` on `SavedChartBasic` as `ChartKind` for list icons.

- [ ] **Step 4: Run tests — expect PASS**

Run: same `ng test` command as Step 2  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/core/models/chart.model.ts mds-ui/src/app/core/models/chart.model.spec.ts
git commit -m "feat(charts): add ChartType union and normalizeChartConfig"
```

---

### Task 2: Mapping, cache, panel view adapters

**Files:**
- Create: `mds-ui/src/app/core/models/chart-config.utils.ts`
- Create: `mds-ui/src/app/core/models/chart-config.utils.spec.ts`

**Interfaces:**
- Consumes: types from Task 1
- Produces:
  - `chartTypeFromKind(kind: ChartKind): ChartType`
  - `chartKindFromConfig(config: ChartConfig): ChartKind`
  - `getValidChartConfig(type: ChartType, cache?: Partial<Record<ChartType, ChartConfig>>, incoming?: ChartConfig): ChartConfig`
  - `ChartConfigCache = Partial<Record<ChartType, ChartConfig>>`
  - `ChartPanelView = { chartKind: ChartKind; xField: FieldId | null; yFields: FieldId[]; displayConfig: ChartDisplayConfig }`
  - `toChartPanelView(config: ChartConfig): ChartPanelView`
  - `applyChartKindChange(current: ChartConfig, cache: ChartConfigCache, kind: ChartKind): { chartConfig: ChartConfig; cache: ChartConfigCache }`
  - `applyChartPanelPatch(current: ChartConfig, patch: Partial<ChartDisplayConfig> & { xField?: FieldId | null; yFields?: FieldId[] }): ChartConfig`

- [ ] **Step 1: Write failing utils tests**

```typescript
import {
  applyChartKindChange,
  chartKindFromConfig,
  chartTypeFromKind,
  toChartPanelView,
} from './chart-config.utils';
import { normalizeChartConfig } from './chart.model';

describe('chart-config.utils', () => {
  it('maps kinds to types', () => {
    expect(chartTypeFromKind('line')).toBe('cartesian');
    expect(chartTypeFromKind('pie')).toBe('pie');
  });

  it('derives kind from cartesian flipAxes', () => {
    const bar = normalizeChartConfig({
      type: 'vertical_bar',
      xField: 'a',
      yFields: ['b'],
    });
    expect(chartKindFromConfig(bar)).toBe('vertical_bar');
    const horiz = applyChartKindChange(bar, {}, 'horizontal_bar').chartConfig;
    expect(chartKindFromConfig(horiz)).toBe('horizontal_bar');
    expect(horiz.type).toBe('cartesian');
  });

  it('caches and restores pie when switching away and back', () => {
    let cache = {};
    const pie = normalizeChartConfig({
      type: 'pie',
      xField: 'status',
      yField: 'rev',
      displayConfig: { showLegend: false },
    });
    const step1 = applyChartKindChange(pie, cache, 'table');
    cache = step1.cache;
    expect(step1.chartConfig.type).toBe('table');
    const step2 = applyChartKindChange(step1.chartConfig, cache, 'pie');
    expect(step2.chartConfig.type).toBe('pie');
    expect(step2.chartConfig.config).toEqual(pie.config);
  });

  it('toChartPanelView exposes flat fields for the existing panel', () => {
    const cfg = normalizeChartConfig({
      type: 'line',
      xField: 'a',
      yField: 'b',
      displayConfig: { showLegend: false },
    });
    const view = toChartPanelView(cfg);
    expect(view.chartKind).toBe('line');
    expect(view.xField).toBe('a');
    expect(view.yFields).toEqual(['b']);
    expect(view.displayConfig.showLegend).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include=src/app/core/models/chart-config.utils.spec.ts`

- [ ] **Step 3: Implement `chart-config.utils.ts`**

`applyChartKindChange`:
1. Clone `current` into `cache[current.type]`
2. If kind is vertical_bar / horizontal_bar / line and current is already cartesian → update `layout.flipAxes` (and keep type `cartesian`) without wiping cache entry unnecessarily
3. Else save cache and `getValidChartConfig(chartTypeFromKind(kind), cache)`

`toChartPanelView`: map family config → flat `ChartDisplayConfig` + fields.  
`applyChartPanelPatch`: merge display/layout/field patches into the active family body.

- [ ] **Step 4: Run tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/core/models/chart-config.utils.ts mds-ui/src/app/core/models/chart-config.utils.spec.ts
git commit -m "feat(charts): add chart config cache and panel adapters"
```

---

### Task 3: Add ECharts + host component

**Files:**
- Modify: `mds-ui/package.json` (add `echarts`)
- Create: `mds-ui/src/app/features/charts/echarts/echart-host.component.ts`
- Create: `mds-ui/src/app/features/charts/echarts/echart-host.component.html` (optional if inline template)
- Create: `mds-ui/src/app/features/charts/echarts/echart-host.component.scss`

**Interfaces:**
- Produces: `EchartHostComponent` with
  - `option = input<EChartsOption | null>(null)`
  - `ariaLabel = input('Chart visualization')`
  - Resizes via `ResizeObserver`
  - Disposes on destroy
  - Null option clears/disposes instance
  - `setOption` failures caught; instance disposed; host left empty

- [ ] **Step 1: Install dependency**

```bash
cd mds-ui && npm install echarts@5
```

Do not add ngx-echarts.

- [ ] **Step 2: Implement host**

```typescript
@Component({
  selector: 'app-echart-host',
  standalone: true,
  template: `<div #container class="echart-host" role="img" [attr.aria-label]="ariaLabel()"></div>`,
  styleUrl: './echart-host.component.scss',
})
export class EchartHostComponent implements AfterViewInit, OnDestroy {
  readonly option = input<EChartsOption | null>(null);
  readonly ariaLabel = input('Chart visualization');
  // effect on option → init/setOption/dispose
  // ResizeObserver → resize()
}
```

```scss
:host,
.echart-host {
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}
```

- [ ] **Step 3: Smoke-compile**

Run: `cd mds-ui && npx ng build --configuration=development`  
Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add mds-ui/package.json mds-ui/package-lock.json mds-ui/src/app/features/charts/echarts/
git commit -m "feat(charts): add ECharts host component"
```

---

### Task 4: Cartesian + pie option builders

**Files:**
- Create: `mds-ui/src/app/features/charts/echarts/build-cartesian-option.ts`
- Create: `mds-ui/src/app/features/charts/echarts/build-pie-option.ts`
- Create: `mds-ui/src/app/features/charts/echarts/build-cartesian-option.spec.ts`
- Create: `mds-ui/src/app/features/charts/echarts/build-pie-option.spec.ts`

**Interfaces:**
- Consumes: `QueryResults`, `CartesianChartConfigBody`, `PieChartConfigBody`, `ChartKind`
- Produces:
  - `buildCartesianOption(args): EChartsOption | null`
  - `buildPieOption(args): EChartsOption | null`
  - Return `null` when required fields missing or no rows

```typescript
export type BuildCartesianArgs = {
  results: QueryResults;
  config: CartesianChartConfigBody;
  chartKind: Extract<ChartKind, 'vertical_bar' | 'horizontal_bar' | 'line'>;
  dashboardMode?: boolean;
};

export type BuildPieArgs = {
  results: QueryResults;
  config: PieChartConfigBody;
  dashboardMode?: boolean;
};
```

Parity targets (good enough vs today’s Chart.js):

- Default colors `#7262ff` / `#e67700` / `#12b886` by kind  
- Legend on/off + left/right/top  
- Grids, axis titles, stack / percent  
- Value labels via series `label.show` when `showValueLabels`  
- Margins via `grid`  
- Horizontal bar when `flipAxes`  
- Multiple `yFields` → multiple series  

- [ ] **Step 1: Write failing builder tests** with a tiny inline `QueryResults` (2 rows, one dimension, one metric); assert `series` length, `xAxis`/`yAxis` presence, pie `series[0].type === 'pie'`

- [ ] **Step 2: Run — expect FAIL**

Run: `cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include=src/app/features/charts/echarts/build-cartesian-option.spec.ts`

- [ ] **Step 3: Implement builders**

- [ ] **Step 4: Run both builder specs — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/charts/echarts/
git commit -m "feat(charts): add ECharts cartesian and pie option builders"
```

---

### Task 5: Rewire `ChartVisualizationComponent`

**Files:**
- Modify: `mds-ui/src/app/features/charts/chart-visualization/chart-visualization.component.ts`
- Modify: `mds-ui/src/app/features/charts/chart-visualization/chart-visualization.component.html`
- Modify: `mds-ui/src/app/features/charts/chart-visualization/chart-visualization.component.scss` (canvas → host sizing)

**Interfaces:**
- New inputs:

```typescript
readonly chartConfig = input.required<ChartConfig>();
readonly queryResults = input<QueryResults | null>(null);
readonly dashboardMode = input(false);
readonly bigNumberComparison = input<BigNumberComparison | null>(null);
readonly unknownTypeNotice = input(false);
```

- Remove all `chart.js` imports/plugins and old `chartKind` / `xField` / `yField` / `displayConfig` inputs  
- Derive `chartKind` via `chartKindFromConfig(chartConfig())` for template branches  
- Template: big_number / table HTML unchanged in structure; else `<app-echart-host [option]="echartsOption()" />`  
- Show a small notice when `unknownTypeNotice()` is true  

- [ ] **Step 1: Rewrite component to compute `echartsOption` from builders**

- [ ] **Step 2: Update template; remove `<canvas>`**

- [ ] **Step 3: Compile**

Run: `cd mds-ui && npx ng build --configuration=development`  
Expected: call-site type errors only (fixed in Task 6) or SUCCESS if already updated

- [ ] **Step 4: Commit**

```bash
git add mds-ui/src/app/features/charts/chart-visualization/
git commit -m "feat(charts): render cartesian and pie with ECharts host"
```

---

### Task 6: Wire explorer, chart view, dashboard tile

**Files:**
- Modify: `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.ts`
- Modify: `mds-ui/src/app/features/explorer/tables-workspace-page/tables-workspace-page.component.html`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.ts`
- Modify: `mds-ui/src/app/features/charts/chart-view-page/chart-view-page.component.html`
- Modify: `mds-ui/src/app/features/dashboards/dashboard-chart-tile/dashboard-chart-tile.component.ts`
- Modify dashboard tile HTML if it binds viz inputs
- Keep `tables-chart-config-panel` public API (`chartKind`, fields, `displayConfig` outputs); adapt in parents

**Parent state pattern:**

```typescript
protected readonly chartConfig = signal<ChartConfig>(defaultConfigForType('cartesian'));
protected readonly cachedChartConfigs = signal<ChartConfigCache>({});
protected readonly panelView = computed(() => toChartPanelView(this.chartConfig()));

protected setChartKind(kind: ChartKind): void {
  const result = applyChartKindChange(
    this.chartConfig(),
    this.cachedChartConfigs(),
    kind,
  );
  this.chartConfig.set(result.chartConfig);
  this.cachedChartConfigs.set(result.cache);
}

protected setChartDisplayConfig(display: ChartDisplayConfig): void {
  this.chartConfig.set(applyChartPanelPatch(this.chartConfig(), display));
}
```

Bind panel from `panelView()`; bind viz with `[chartConfig]="chartConfig()"`.  
On save: persist `chartConfig()` + `chartKindFromConfig(...)`.  
On load: `normalizeChartConfig(saved.chartConfig)`.

- [ ] **Step 1: Update workspace page**

- [ ] **Step 2: Update chart-view page**

- [ ] **Step 3: Update dashboard tile**

- [ ] **Step 4: Build — expect SUCCESS**

Run: `cd mds-ui && npx ng build --configuration=development`

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/features/explorer/tables-workspace-page/ \
  mds-ui/src/app/features/charts/chart-view-page/ \
  mds-ui/src/app/features/dashboards/dashboard-chart-tile/
git commit -m "feat(charts): wire typed chartConfig and type-switch cache"
```

---

### Task 7: Fixtures, mock API, backend seed/tests

**Files:**
- Modify: `mds-ui/src/app/core/mock/fixtures/charts.fixture.ts`
- Modify: mock create/update helpers that assume legacy `ChartConfig`
- Modify: `mds-backend/src/mds/db/seed.py` chart_config dicts (prefer new shape)
- Modify: `mds-backend/tests/test_saved_charts.py` if nested assertions break
- Modify: `mds-backend/src/mds/services/ai_assistant.py` sample `chartConfig` if present

- [ ] **Step 1: Convert fixture `chartConfig` objects to normalized shape; keep `chartKind` for lists**

Example cartesian fixture body:

```typescript
chartConfig: {
  type: 'cartesian',
  config: {
    layout: {
      xField: getFieldId('orders', 'order_date'),
      yFields: [getFieldId('orders', 'total_revenue')],
      flipAxes: false,
      stackMode: 'none',
      showGridX: true,
      showGridY: true,
      showXAxis: true,
      showYAxis: true,
      xAxisLabel: '',
      yAxisLabel: '',
    },
    showLegend: false,
    legendPlacement: 'chart',
    rowLimit: 500,
    margins: { top: 8, right: 8, bottom: 8, left: 8 },
    seriesColor: '#e67700',
    showValueLabels: true,
  },
},
```

- [ ] **Step 2: Ensure create/update mock paths store `normalizeChartConfig(payload.chartConfig)`**

- [ ] **Step 3: Update backend seed + chart tests**

- [ ] **Step 4: Run tests**

```bash
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/core/models/**/*.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/features/charts/echarts/**/*.spec.ts'
cd mds-backend && python -m pytest tests/test_saved_charts.py -q
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add mds-ui/src/app/core/mock/fixtures/charts.fixture.ts mds-ui/src/app/core/mock/ \
  mds-backend/src/mds/db/seed.py mds-backend/tests/test_saved_charts.py \
  mds-backend/src/mds/services/ai_assistant.py
git commit -m "chore(charts): migrate fixtures and seeds to typed chartConfig"
```

---

### Task 8: Remove Chart.js + verification

**Files:**
- Modify: `mds-ui/package.json` — remove `chart.js`

- [ ] **Step 1: Grep remaining usage**

```bash
rg -n "chart\\.js|from 'chart.js'" mds-ui/src
```

Expected: no matches

- [ ] **Step 2: Uninstall**

```bash
cd mds-ui && npm uninstall chart.js
```

- [ ] **Step 3: Full build + targeted tests**

```bash
cd mds-ui && npx ng build --configuration=development
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/core/models/**/*.spec.ts'
cd mds-ui && npx ng test --no-watch --browsers=ChromeHeadless --include='src/app/features/charts/**/*.spec.ts'
```

- [ ] **Step 4: Manual smoke (Chromium + Firefox)**

For each of vertical bar, horizontal bar, line, pie, table, big number — in explorer and chart view:

- Renders without console errors  
- Configure panel still edits layout/display  
- Switch pie → bar → pie restores pie settings  
- No horizontal page scroll  

- [ ] **Step 5: Commit**

```bash
git add mds-ui/package.json mds-ui/package-lock.json
git commit -m "chore(charts): remove chart.js dependency"
```

- [ ] **Step 6: Set spec status to Accepted in `docs/superpowers/specs/2026-08-03-chart-viz-foundation-design.md` and commit if status line changed**

```bash
git add docs/superpowers/specs/2026-08-03-chart-viz-foundation-design.md
git commit -m "docs: mark chart viz foundation spec accepted"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| ECharts replaces Chart.js | 3, 4, 5, 8 |
| ChartType + ChartKind + discriminated config | 1 |
| Config cache on type switch | 2, 6 |
| Keep current panel UX | 2, 6 |
| normalize legacy payloads | 1, 7 |
| Reserved future ChartTypes | 1 (normalize → table) |
| Table/big number HTML | 5 |
| Unknown type → table + notice | 1, 5, 6 |
| D3-ready builders/host boundary | 3, 4 |
| Tests for normalize/cache/builders | 1, 2, 4 |
| Fixtures/API | 7 |

## Locked implementation choices

- Raw `echarts` + `EchartHostComponent` (not ngx-echarts)  
- v1 cartesian body is slimmer than Lightdash `eChartsConfig.series`  
- Panel stays on flat inputs; parents adapt via utils  
- Future types without UI normalize to `table`  
