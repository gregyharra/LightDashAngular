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
