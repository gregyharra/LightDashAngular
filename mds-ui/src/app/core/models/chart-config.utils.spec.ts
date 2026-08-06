import {
  applyChartKindChange,
  applyChartPanelPatch,
  chartKindFromConfig,
  chartTypeFromKind,
  getValidChartConfig,
  toChartPanelView,
} from './chart-config.utils';
import { defaultConfigForType, normalizeChartConfig } from './chart.model';

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

  it('fresh pie configs can receive group and metric via panel patch after kind switch', () => {
    const cartesian = normalizeChartConfig({
      type: 'vertical_bar',
      xField: 'status',
      yField: 'rev',
    });
    const switched = applyChartKindChange(cartesian, {}, 'pie').chartConfig;
    expect(switched.type).toBe('pie');
    if (switched.type !== 'pie') {
      return;
    }
    expect(switched.config.xField).toBeUndefined();
    expect(switched.config.yField).toBeUndefined();

    const patched = applyChartPanelPatch(switched, {
      xField: 'status',
      yFields: ['rev'],
    });
    expect(patched.type).toBe('pie');
    if (patched.type === 'pie') {
      expect(patched.config.xField).toBe('status');
      expect(patched.config.yField).toBe('rev');
    }
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

  it('applyChartPanelPatch keeps line kind when full displayConfig includes flipAxes', () => {
    const line = normalizeChartConfig({
      type: 'line',
      xField: 'a',
      yField: 'b',
      displayConfig: { showLegend: true, flipAxes: false },
    });
    const view = toChartPanelView(line);
    const patched = applyChartPanelPatch(line, view.displayConfig);
    expect(chartKindFromConfig(patched)).toBe('line');
    expect(patched.type).toBe('cartesian');
    if (patched.type === 'cartesian') {
      expect(patched.config.layout.cartesianKind).toBe('line');
    }
  });

  it('getValidChartConfig rejects mismatched cache entry', () => {
    const pie = normalizeChartConfig({ type: 'pie', xField: 'a', yField: 'b' });
    const defaultTable = getValidChartConfig('table');
    const restored = getValidChartConfig('table', { table: pie });
    expect(restored.type).toBe('table');
    expect(restored).toEqual(defaultTable);
  });
});

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

  it('applyChartPanelPatch keeps mixed series in sync when yFields change', () => {
    const config = defaultConfigForType('cartesian');
    if (config.type !== 'cartesian') throw new Error('expected cartesian');
    config.config.layout.cartesianKind = 'mixed';
    config.config.layout.yFields = ['m1', 'm2'];
    config.config.series = [
      { fieldId: 'm1', type: 'bar' },
      { fieldId: 'm2', type: 'line' },
    ];
    const patched = applyChartPanelPatch(config, { yFields: ['m2', 'm3'] });
    expect(patched.type).toBe('cartesian');
    if (patched.type === 'cartesian') {
      expect(patched.config.series).toEqual([
        { fieldId: 'm2', type: 'line' },
        { fieldId: 'm3', type: 'bar' },
      ]);
    }
  });

  it('panel patch updates funnel, treemap and gauge fields', () => {
    const funnel = applyChartPanelPatch(defaultConfigForType('funnel'), {
      funnelDataInput: 'row',
    });
    expect(funnel.type).toBe('funnel');
    if (funnel.type === 'funnel') {
      expect(funnel.config.dataInput).toBe('row');
    }

    const treemap = applyChartPanelPatch(defaultConfigForType('treemap'), {
      treemapDimensionFieldIds: ['orders_status', 'orders_city'],
    });
    expect(treemap.type).toBe('treemap');
    if (treemap.type === 'treemap') {
      expect(treemap.config.dimensionFieldIds).toEqual(['orders_status', 'orders_city']);
    }

    const gauge = applyChartPanelPatch(defaultConfigForType('gauge'), {
      gaugeMin: 0,
      gaugeMax: 100,
      showGaugeLabel: false,
    });
    expect(gauge.type).toBe('gauge');
    if (gauge.type === 'gauge') {
      expect(gauge.config.min).toBe(0);
      expect(gauge.config.max).toBe(100);
      expect(gauge.config.showLabel).toBe(false);
    }
  });

  it('toChartPanelView exposes funnel/treemap/gauge/sankey family fields', () => {
    const sankey = defaultConfigForType('sankey');
    if (sankey.type !== 'sankey') throw new Error('expected sankey');
    sankey.config.sourceFieldId = 'orders_status';
    sankey.config.targetFieldId = 'orders_city';
    sankey.config.weightFieldId = 'orders_order_count';
    const sankeyView = toChartPanelView(sankey);
    expect(sankeyView.sankeySourceFieldId).toBe('orders_status');
    expect(sankeyView.sankeyTargetFieldId).toBe('orders_city');
    expect(sankeyView.sankeyWeightFieldId).toBe('orders_order_count');

    const gauge = defaultConfigForType('gauge');
    if (gauge.type !== 'gauge') throw new Error('expected gauge');
    gauge.config.min = 0;
    gauge.config.max = 50;
    const gaugeView = toChartPanelView(gauge);
    expect(gaugeView.gaugeMin).toBe(0);
    expect(gaugeView.gaugeMax).toBe(50);
    expect(gaugeView.showGaugeLabel).toBe(true);

    const treemap = defaultConfigForType('treemap');
    if (treemap.type !== 'treemap') throw new Error('expected treemap');
    treemap.config.dimensionFieldIds = ['orders_status'];
    const treemapView = toChartPanelView(treemap);
    expect(treemapView.treemapDimensionFieldIds).toEqual(['orders_status']);

    const funnel = defaultConfigForType('funnel');
    if (funnel.type !== 'funnel') throw new Error('expected funnel');
    funnel.config.dataInput = 'row';
    const funnelView = toChartPanelView(funnel);
    expect(funnelView.funnelDataInput).toBe('row');
  });
});
