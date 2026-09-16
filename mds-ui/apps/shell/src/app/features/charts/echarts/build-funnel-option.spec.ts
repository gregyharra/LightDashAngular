import { FunnelChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';
import { buildFunnelOption } from './build-funnel-option';

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

const config: FunnelChartConfigBody = {
  fieldId: 'orders_total',
  labelFieldId: 'orders_status',
  dataInput: 'column',
  showLegend: true,
  legendPlacement: 'chart',
  rowLimit: 500,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
};

describe('buildFunnelOption', () => {
  it('builds funnel series from fieldId', () => {
    const option = buildFunnelOption({ results, config });
    const series = option?.series as Array<{ type?: string; data?: unknown[] }>;
    expect(series?.[0].type).toBe('funnel');
    expect(series?.[0].data?.length).toBe(2);
  });

  it('uses formatted labels from labelFieldId in column mode', () => {
    const option = buildFunnelOption({ results, config });
    const series = option?.series as Array<{
      data?: { name: string; value: number }[];
    }>;
    expect(series?.[0].data).toEqual([
      { name: 'New', value: 12 },
      { name: 'Shipped', value: 30 },
    ]);
  });

  it('returns null without fieldId, rows, or missing field in results', () => {
    expect(
      buildFunnelOption({ results: { ...results, rows: [] }, config }),
    ).toBeNull();
    expect(
      buildFunnelOption({
        results,
        config: { ...config, fieldId: undefined },
      }),
    ).toBeNull();
    expect(
      buildFunnelOption({
        results,
        config: { ...config, fieldId: 'missing_metric' },
      }),
    ).toBeNull();
  });
});
