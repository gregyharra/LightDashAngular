import {
  applyDashboardContextToMetricQuery,
  mergeDashboardFiltersIntoMetricQuery,
} from './dashboard-filters';
import { MetricQuery } from '../../core/models/explore.model';
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

describe('dashboard-filters', () => {
  it('merges active dimension filters into metric query', () => {
    const merged = mergeDashboardFiltersIntoMetricQuery(baseQuery, [activeFilter]);

    expect(merged.filters).toEqual({
      dimensions: [
        {
          id: 'filter-1',
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

  it('applies dashboard context with time travel', () => {
    const merged = applyDashboardContextToMetricQuery(
      baseQuery,
      [activeFilter],
      { asOfTimestamp: '2024-01-01T00:00:00.000Z' },
    );

    expect(merged.filters['dimensions']).toHaveSize(1);
    expect(merged.timeTravel?.asOfTimestamp).toBe('2024-01-01T00:00:00.000Z');
  });
});
