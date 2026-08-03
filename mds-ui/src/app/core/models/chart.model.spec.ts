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
    if (result.type === 'cartesian') {
      expect(result.config.layout.xField).toBe('orders_order_date');
      expect(result.config.layout.yFields).toEqual(['orders_total_revenue']);
      expect(result.config.seriesColor).toBe('#e67700');
      expect(result.config.showValueLabels).toBe(true);
    }
  });

  it('migrates horizontal_bar with flipAxes', () => {
    const result = normalizeChartConfig({
      type: 'horizontal_bar',
      xField: 'a',
      yFields: ['b'],
      displayConfig: { flipAxes: true },
    });
    expect(result.type).toBe('cartesian');
    if (result.type === 'cartesian') {
      expect(result.config.layout.flipAxes).toBe(true);
    }
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
