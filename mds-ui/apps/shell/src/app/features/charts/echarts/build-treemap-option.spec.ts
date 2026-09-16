import { TreemapChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';
import { buildTreemapOption } from './build-treemap-option';

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

const config: TreemapChartConfigBody = {
  dimensionFieldIds: ['orders_status'],
  metricFieldId: 'orders_total',
  showLegend: true,
  rowLimit: 500,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
};

describe('buildTreemapOption', () => {
  it('builds treemap series with non-empty data', () => {
    const option = buildTreemapOption({ results, config });
    const series = option?.series as Array<{ type?: string; data?: unknown[] }>;
    expect(series?.[0].type).toBe('treemap');
    expect(series?.[0].data?.length).toBeGreaterThan(0);
  });

  it('uses formatted dimension labels for single-dimension leaves', () => {
    const option = buildTreemapOption({ results, config });
    const series = option?.series as Array<{
      data?: { name: string; children?: { name: string; value: number }[] }[];
    }>;
    const root = series?.[0].data?.[0];
    expect(root?.children).toEqual([
      { name: 'New', value: 12 },
      { name: 'Shipped', value: 30 },
    ]);
  });

  it('builds nested children for multiple dimensions', () => {
    const nestedResults: QueryResults = {
      ...results,
      rows: [
        {
          orders_region: { value: { raw: 'east', formatted: 'East' } },
          orders_status: { value: { raw: 'new', formatted: 'New' } },
          orders_total: { value: { raw: 12, formatted: '12' } },
        },
        {
          orders_region: { value: { raw: 'west', formatted: 'West' } },
          orders_status: { value: { raw: 'shipped', formatted: 'Shipped' } },
          orders_total: { value: { raw: 30, formatted: '30' } },
        },
      ],
      fields: {
        ...results.fields,
        orders_region: {
          fieldId: 'orders_region',
          fieldType: 'dimension',
          type: 'string',
          name: 'region',
          label: 'Region',
          table: 'orders',
          tableLabel: 'Orders',
          sql: '${TABLE}.region',
          hidden: false,
        },
      },
    };

    const option = buildTreemapOption({
      results: nestedResults,
      config: {
        ...config,
        dimensionFieldIds: ['orders_region', 'orders_status'],
      },
    });
    const series = option?.series as Array<{
      data?: { children?: { name: string; children?: { name: string; value: number }[] }[] }[];
    }>;
    const regions = series?.[0].data?.[0]?.children;
    expect(regions?.map((node) => node.name)).toEqual(['East', 'West']);
    expect(regions?.[0].children?.[0]).toEqual({ name: 'New', value: 12 });
  });

  it('returns null without metric, dimensions, rows, or missing fields', () => {
    expect(
      buildTreemapOption({ results: { ...results, rows: [] }, config }),
    ).toBeNull();
    expect(
      buildTreemapOption({
        results,
        config: { ...config, metricFieldId: undefined },
      }),
    ).toBeNull();
    expect(
      buildTreemapOption({
        results,
        config: { ...config, dimensionFieldIds: [] },
      }),
    ).toBeNull();
    expect(
      buildTreemapOption({
        results,
        config: { ...config, metricFieldId: 'missing_metric' },
      }),
    ).toBeNull();
  });
});
