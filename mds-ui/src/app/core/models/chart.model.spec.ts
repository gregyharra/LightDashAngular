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

  it('forces flipAxes true for horizontal_bar without displayConfig', () => {
    const result = normalizeChartConfig({
      type: 'horizontal_bar',
      xField: 'a',
      yFields: ['b'],
    });
    expect(result.type).toBe('cartesian');
    if (result.type === 'cartesian') {
      expect(result.config.layout.flipAxes).toBe(true);
    }
  });

  it('forces flipAxes false for vertical_bar even when displayConfig says true', () => {
    const result = normalizeChartConfig({
      type: 'vertical_bar',
      xField: 'a',
      yFields: ['b'],
      displayConfig: { flipAxes: true },
    });
    expect(result.type).toBe('cartesian');
    if (result.type === 'cartesian') {
      expect(result.config.layout.flipAxes).toBe(false);
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

  it('migrates legacy pie chart', () => {
    const result = normalizeChartConfig({
      type: 'pie',
      xField: 'orders_status',
      yField: 'orders_total_revenue',
      displayConfig: { showLegend: false, rowLimit: 100 },
    });
    expect(result.type).toBe('pie');
    if (result.type === 'pie') {
      expect(result.config.xField).toBe('orders_status');
      expect(result.config.yField).toBe('orders_total_revenue');
      expect(result.config.showLegend).toBe(false);
      expect(result.config.rowLimit).toBe(100);
    }
  });

  it('migrates legacy table chart', () => {
    const result = normalizeChartConfig({
      type: 'table',
      displayConfig: {
        showTableNames: false,
        showColumnTotals: true,
        rowLimit: 200,
      },
    });
    expect(result.type).toBe('table');
    if (result.type === 'table') {
      expect(result.config.showTableNames).toBe(false);
      expect(result.config.showColumnTotals).toBe(true);
      expect(result.config.rowLimit).toBe(200);
    }
  });

  it('migrates legacy big_number chart', () => {
    const result = normalizeChartConfig({
      type: 'big_number',
      yField: 'orders_total_revenue',
      displayConfig: { rowLimit: 50 },
    });
    expect(result.type).toBe('big_number');
    if (result.type === 'big_number') {
      expect(result.config.selectedField).toBe('orders_total_revenue');
      expect(result.config.rowLimit).toBe(50);
    }
  });

  it('passes through already-normalized pie', () => {
    const input = {
      type: 'pie' as const,
      config: {
        xField: 'a',
        yField: 'b',
        showLegend: true,
        legendPlacement: 'chart' as const,
        rowLimit: 500,
        margins: { top: 8, right: 8, bottom: 8, left: 8 },
      },
    };
    expect(normalizeChartConfig(input)).toEqual(input);
  });
});
