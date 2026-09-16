import { SankeyChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';
import { buildSankeyOption } from './build-sankey-option';

const results: QueryResults = {
  queryUuid: 'query-sankey',
  metricQuery: {
    exploreName: 'orders',
    dimensions: ['orders_status', 'orders_store_id'],
    metrics: ['orders_order_count'],
    filters: {},
    sorts: [],
    limit: 500,
    tableCalculations: [],
    additionalMetrics: [],
  },
  rows: [
    {
      orders_status: { value: { raw: 'new', formatted: 'New' } },
      orders_store_id: { value: { raw: 's1', formatted: 'Store 1' } },
      orders_order_count: { value: { raw: 10, formatted: '10' } },
    },
    {
      orders_status: { value: { raw: 'new', formatted: 'New' } },
      orders_store_id: { value: { raw: 's2', formatted: 'Store 2' } },
      orders_order_count: { value: { raw: 5, formatted: '5' } },
    },
    {
      orders_status: { value: { raw: 'shipped', formatted: 'Shipped' } },
      orders_store_id: { value: { raw: 's1', formatted: 'Store 1' } },
      orders_order_count: { value: { raw: 7, formatted: '7' } },
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
    orders_store_id: {
      fieldId: 'orders_store_id',
      fieldType: 'dimension',
      type: 'string',
      name: 'store_id',
      label: 'Store',
      table: 'orders',
      tableLabel: 'Orders',
      sql: '${TABLE}.store_id',
      hidden: false,
    },
    orders_order_count: {
      fieldId: 'orders_order_count',
      fieldType: 'metric',
      type: 'count',
      name: 'order_count',
      label: 'Order count',
      table: 'orders',
      tableLabel: 'Orders',
      sql: 'COUNT(*)',
      hidden: false,
    },
  },
  cacheMetadata: { cacheHit: false },
};

const config: SankeyChartConfigBody = {
  sourceFieldId: 'orders_status',
  targetFieldId: 'orders_store_id',
  weightFieldId: 'orders_order_count',
  showNodeLabels: true,
  rowLimit: 500,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
};

describe('buildSankeyOption', () => {
  it('builds sankey nodes and links from rows', () => {
    const option = buildSankeyOption({ results, config });
    const series = option?.series as Array<{
      type?: string;
      data?: Array<{ name: string }>;
      links?: Array<{ source: string; target: string; value: number }>;
    }>;
    expect(series?.[0].type).toBe('sankey');
    expect(series?.[0].data?.map((n) => n.name).sort()).toEqual([
      'New',
      'Shipped',
      'Store 1',
      'Store 2',
    ]);
    expect(series?.[0].links?.length).toBe(3);
  });

  it('returns null when no valid links remain', () => {
    const option = buildSankeyOption({
      results: {
        ...results,
        rows: [
          {
            orders_status: { value: { raw: 'new', formatted: 'New' } },
            orders_store_id: { value: { raw: 'new', formatted: 'New' } },
            orders_order_count: { value: { raw: 10, formatted: '10' } },
          },
        ],
      },
      config,
    });
    expect(option).toBeNull();
  });
});
