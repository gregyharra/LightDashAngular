import {
  applyDashboardContextToMetricQuery,
  extractDashboardFiltersFromMetricQuery,
  formatDashboardFilterSummary,
  formatFilterOperator,
  mergeDashboardFiltersIntoMetricQuery,
} from './dashboard-filters';
import { Explore, MetricQuery } from '../../core/models/explore.model';
import { DashboardDimensionFilter } from '../../core/models/dashboard.model';

const baseQuery: MetricQuery = {
  exploreName: 'orders',
  dimensions: ['orders_status'],
  metrics: ['orders_order_count'],
  filters: {},
  sorts: [],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

const activeFilter: DashboardDimensionFilter = {
  id: 'filter-1',
  label: 'Status',
  operator: 'equals',
  target: {
    fieldId: 'orders_status',
    tableName: 'orders',
  },
  values: ['completed'],
};

const tileExplore: Explore = {
  name: 'orders',
  label: 'Orders',
  tags: [],
  baseTable: 'orders',
  joinedTables: [],
  targetDatabase: 'default',
  tables: {
    orders: {
      name: 'orders',
      label: 'Orders',
      database: 'default',
      schema: 'public',
      sqlTable: 'orders',
      dimensions: {
        status: {
          fieldType: 'dimension',
          type: 'string',
          name: 'status',
          label: 'Status',
          table: 'orders',
          tableLabel: 'Orders',
          sql: '${TABLE}.status',
          hidden: false,
        },
      },
      metrics: {},
    },
  },
};

describe('dashboard-filters', () => {
  const translations: Record<string, string> = {
    'dashboardFilters.anyValue': 'toute valeur',
    'dashboardFilters.operators.equals': 'est',
    'dashboardFilters.operators.inThePast': 'dans les derniers',
    'dashboardFilters.units.days': 'jours',
  };
  const translate = (key: string): string => translations[key] ?? key;

  it('resolves filter operator labels through translations', () => {
    expect(formatFilterOperator('equals', translate)).toBe('est');
    expect(
      formatDashboardFilterSummary(
        { ...activeFilter, operator: 'inThePast', values: [7], settings: { unitOfTime: 'days' } },
        translate,
      ),
    ).toBe('Status dans les derniers 7 jours');
  });

  it('translates the empty filter value fallback', () => {
    expect(
      formatDashboardFilterSummary(
        { ...activeFilter, values: [] },
        translate,
      ),
    ).toBe('Status est toute valeur');
  });

  it('merges active dimension filters into metric query', () => {
    const merged = mergeDashboardFiltersIntoMetricQuery(baseQuery, [activeFilter]);

    expect(merged.filters).toEqual({
      dimensions: [
        {
          id: 'filter-1',
          label: 'Status',
          target: {
            fieldId: 'orders_status',
            tableName: 'orders',
          },
          operator: 'equals',
          values: ['completed'],
          settings: undefined,
        },
      ],
    });
  });

  it('skips disabled filters and filters without values', () => {
    const merged = mergeDashboardFiltersIntoMetricQuery(baseQuery, [
      { ...activeFilter, disabled: true },
      {
        ...activeFilter,
        id: 'filter-2',
        operator: 'equals',
        values: [],
      },
    ]);

    expect(merged).toBe(baseQuery);
  });

  it('includes nullability filters without values', () => {
    const merged = mergeDashboardFiltersIntoMetricQuery(baseQuery, [
      {
        ...activeFilter,
        operator: 'isNull',
        values: [],
      },
    ]);

    expect(merged.filters['dimensions']).toEqual([
      {
        id: 'filter-1',
        label: 'Status',
        target: {
          fieldId: 'orders_status',
          tableName: 'orders',
        },
        operator: 'isNull',
        values: [],
        settings: undefined,
      },
    ]);
  });

  it('drops dashboard filters that are absent from the tile explore', () => {
    const merged = mergeDashboardFiltersIntoMetricQuery(
      baseQuery,
      [{ ...activeFilter, target: { fieldId: 'customers_country', tableName: 'customers' } }],
      tileExplore,
    );

    expect(merged).toBe(baseQuery);
  });

  it('applies dashboard context with time travel', () => {
    const merged = applyDashboardContextToMetricQuery(
      baseQuery,
      [activeFilter],
      { asOfTimestamp: '2024-01-01T00:00:00.000Z' },
    );

    expect(merged.filters['dimensions']).toHaveSize(1);
    expect(merged.timeTravel?.asOfTimestamp).toBe('2024-01-01T00:00:00.000Z');
  });

  it('round-trips filters so saved chart filters reappear after reload', () => {
    const merged = mergeDashboardFiltersIntoMetricQuery(baseQuery, [activeFilter]);
    const restored = extractDashboardFiltersFromMetricQuery(merged, tileExplore);

    expect(restored).toEqual([
      {
        id: 'filter-1',
        label: 'Status',
        operator: 'equals',
        target: {
          fieldId: 'orders_status',
          tableName: 'orders',
        },
        values: ['completed'],
      },
    ]);
  });

  it('falls back to fieldId label when explore is unavailable', () => {
    const restored = extractDashboardFiltersFromMetricQuery({
      ...baseQuery,
      filters: {
        dimensions: [
          {
            id: 'filter-1',
            target: { fieldId: 'orders_status', tableName: 'orders' },
            operator: 'equals',
            values: ['completed'],
          },
        ],
      },
    });

    expect(restored[0]?.label).toBe('orders_status');
    expect(restored[0]?.values).toEqual(['completed']);
  });
});
