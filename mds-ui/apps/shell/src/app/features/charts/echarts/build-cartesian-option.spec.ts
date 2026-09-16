import { CartesianChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';
import { buildCartesianOption } from './build-cartesian-option';

const results: QueryResults = {
  queryUuid: 'query-1',
  metricQuery: {
    exploreName: 'orders',
    dimensions: ['orders_status'],
    metrics: ['orders_total'],
    filters: {},
    sorts: [],
    limit: 500,
    tableCalculations: [],
    additionalMetrics: [],
  },
  rows: [
    {
      orders_status: { value: { raw: 'new', formatted: 'New' } },
      orders_total: { value: { raw: 12, formatted: '12' } },
    },
    {
      orders_status: { value: { raw: 'shipped', formatted: 'Shipped' } },
      orders_total: { value: { raw: 30, formatted: '30' } },
    },
  ],
  fields: {
    orders_status: {
      fieldId: 'orders_status',
      fieldType: 'dimension',
      type: 'string',
      name: 'status',
      label: 'Status',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.status',
      hidden: false,
    },
    orders_total: {
      fieldId: 'orders_total',
      fieldType: 'metric',
      type: 'sum',
      name: 'total',
      label: 'Total',
      table: 'orders',
      tableLabel: 'Orders',
      sql: 'SUM(${TABLE}.total)',
      hidden: false,
    },
  },
  cacheMetadata: { cacheHit: false },
};

const config: CartesianChartConfigBody = {
  layout: {
    xField: 'orders_status',
    yFields: ['orders_total'],
    cartesianKind: 'vertical_bar',
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
  showValueLabels: true,
};

describe('buildCartesianOption', () => {
  it('builds one bar series and category/value axes', () => {
    const option = buildCartesianOption({
      results,
      config,
      chartKind: 'vertical_bar',
    });

    expect(option).not.toBeNull();
    expect((option?.series as { type?: string }[]).length).toBe(1);
    expect((option?.series as { type?: string }[])[0].type).toBe('bar');
    expect((option?.xAxis as { type?: string }).type).toBe('category');
    expect((option?.yAxis as { type?: string }).type).toBe('value');
  });

  it('uses formatted category labels and raw metric values', () => {
    const option = buildCartesianOption({
      results,
      config,
      chartKind: 'vertical_bar',
    });

    expect((option?.xAxis as { data?: string[] }).data).toEqual([
      'New',
      'Shipped',
    ]);
    expect((option?.series as { data?: number[] }[])[0].data).toEqual([12, 30]);
  });

  it('builds one line series per y field with distinct colors', () => {
    const comparisonField = {
      fieldId: 'orders_average',
      fieldType: 'metric' as const,
      type: 'average' as const,
      name: 'average',
      label: 'Average',
      table: 'orders',
      tableLabel: 'Orders',
      sql: 'AVG(${TABLE}.total)',
      hidden: false,
    };
    const option = buildCartesianOption({
      results: {
        ...results,
        rows: results.rows.map((row, index) => ({
          ...row,
          orders_average: {
            value: { raw: index + 2, formatted: `${index + 2}` },
          },
        })),
        fields: { ...results.fields, orders_average: comparisonField },
      },
      config: {
        ...config,
        layout: {
          ...config.layout,
          yFields: ['orders_total', 'orders_average'],
        },
      },
      chartKind: 'line',
    });

    const series = option?.series as {
      type?: string;
      areaStyle?: unknown;
      itemStyle?: { color?: string };
    }[];
    expect(series.length).toBe(2);
    expect(series[0].type).toBe('line');
    expect(series[0].itemStyle?.color).toBe('#e67700');
    expect(series[1].itemStyle?.color).not.toBe(series[0].itemStyle?.color);
    expect(series[0].areaStyle).toBeUndefined();
  });

  it('flips axes and keeps dimension/metric titles on the correct physical axes', () => {
    const option = buildCartesianOption({
      results,
      config: {
        ...config,
        layout: {
          ...config.layout,
          flipAxes: true,
          stackMode: 'percent',
          xAxisLabel: 'Order status',
          yAxisLabel: 'Order total',
        },
        legendPlacement: 'outside-left',
        margins: { top: 10, right: 20, bottom: 30, left: 40 },
      },
      chartKind: 'horizontal_bar',
    });

    const series = (
      option?.series as {
        stack?: string;
        label?: { show?: boolean };
      }[]
    )[0];
    expect((option?.xAxis as { type?: string; max?: number }).type).toBe(
      'value',
    );
    expect((option?.xAxis as { max?: number; name?: string }).max).toBe(100);
    expect((option?.xAxis as { name?: string }).name).toBe('Order total');
    expect((option?.yAxis as { type?: string; data?: string[] }).type).toBe(
      'category',
    );
    expect((option?.yAxis as { name?: string }).name).toBe('Order status');
    expect((option?.yAxis as { data?: string[] }).data).toEqual([
      'New',
      'Shipped',
    ]);
    expect(series.stack).toBe('stack');
    expect(series.label?.show).toBeTrue();
    expect(option?.grid).toEqual(
      jasmine.objectContaining({
        top: 10,
        right: 20,
        bottom: 30,
        left: 96,
        containLabel: true,
      }),
    );
    expect(option?.legend).toEqual(
      jasmine.objectContaining({
        show: true,
        left: 'left',
        orient: 'vertical',
      }),
    );
  });

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


  it('returns null without required fields, rows, or fields missing from results', () => {
    expect(
      buildCartesianOption({
        results: { ...results, rows: [] },
        config,
        chartKind: 'vertical_bar',
      }),
    ).toBeNull();
    expect(
      buildCartesianOption({
        results,
        config: {
          ...config,
          layout: { ...config.layout, xField: undefined },
        },
        chartKind: 'vertical_bar',
      }),
    ).toBeNull();
    expect(
      buildCartesianOption({
        results,
        config: {
          ...config,
          layout: { ...config.layout, xField: 'missing_dim' },
        },
        chartKind: 'vertical_bar',
      }),
    ).toBeNull();
  });
});
