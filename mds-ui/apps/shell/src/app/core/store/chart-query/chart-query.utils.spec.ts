import { chartQueryKey } from './chart-query.utils';

describe('chartQueryKey', () => {
  it('normalizes disabled flag so view and edit filters produce the same key', () => {
    const base = {
      kind: 'dashboardChart' as const,
      projectUuid: 'project-1',
      savedChartUuid: 'chart-1',
      dateZoomGranularity: 'Month' as const,
      timeTravel: null,
      dashboardFilters: [
        {
          id: 'f1',
          label: 'Status',
          operator: 'equals' as const,
          target: { fieldId: 'orders.status', tableName: 'orders' },
          values: ['completed'],
        },
      ],
    };

    const withDisabledFalse = chartQueryKey({
      ...base,
      dashboardFilters: [{ ...base.dashboardFilters[0], disabled: false }],
    });
    const withDisabledUndefined = chartQueryKey({
      ...base,
      dashboardFilters: [{ ...base.dashboardFilters[0], disabled: undefined }],
    });

    expect(withDisabledFalse).toBe(withDisabledUndefined);
  });

  it('produces distinct keys for saved chart view and metric query inputs', () => {
    const savedChartKey = chartQueryKey({
      kind: 'savedChartView',
      projectUuid: 'project-1',
      savedChartUuid: 'chart-1',
      dimensionFilters: [],
    });
    const metricQueryKey = chartQueryKey({
      kind: 'metricQuery',
      projectUuid: 'project-1',
      metricQuery: {
        exploreName: 'orders',
        dimensions: ['orders.status'],
        metrics: ['orders.count'],
        filters: {},
        sorts: [],
        limit: 500,
        tableCalculations: [],
        additionalMetrics: [],
      },
      dimensionFilters: [],
      timeTravel: null,
    });

    expect(savedChartKey).not.toBe(metricQueryKey);
  });
});
