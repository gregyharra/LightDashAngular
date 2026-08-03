import { PieChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';
import { buildPieOption } from './build-pie-option';

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

const config: PieChartConfigBody = {
  xField: 'orders_status',
  yField: 'orders_total',
  showLegend: true,
  legendPlacement: 'outside-right',
  rowLimit: 500,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
};

describe('buildPieOption', () => {
  it('builds a pie series from formatted labels and raw values', () => {
    const option = buildPieOption({ results, config });
    const series = (
      option?.series as {
        type?: string;
        data?: { name: string; value: number }[];
      }[]
    )[0];

    expect(series.type).toBe('pie');
    expect(series.data).toEqual([
      { name: 'New', value: 12 },
      { name: 'Shipped', value: 30 },
    ]);
  });

  it('applies legend placement and margins', () => {
    const option = buildPieOption({ results, config });

    expect(option?.legend).toEqual(
      jasmine.objectContaining({
        show: true,
        right: 'right',
        orient: 'vertical',
      }),
    );
    expect(option?.grid).toEqual({
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
      containLabel: true,
    });
  });

  it('returns null without required fields or rows', () => {
    expect(
      buildPieOption({ results: { ...results, rows: [] }, config }),
    ).toBeNull();
    expect(
      buildPieOption({
        results,
        config: { ...config, yField: undefined },
      }),
    ).toBeNull();
  });
});
