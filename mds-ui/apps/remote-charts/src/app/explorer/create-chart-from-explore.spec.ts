import {
  CREATE_FROM_EXPLORE_STATE_KEY,
  CreateChartFromExploreState,
} from './create-chart-from-explore';

describe('create-chart-from-explore', () => {
  it('uses createFromExplore as the router state key', () => {
    expect(CREATE_FROM_EXPLORE_STATE_KEY).toBe('createFromExplore');
  });

  it('CreateChartFromExploreState includes explore fields', () => {
    const state: CreateChartFromExploreState = {
      exploreName: 'orders',
      dimensions: ['orders_status'],
      metrics: ['orders_amount'],
      filters: {},
      sorts: [],
      additionalMetrics: [],
      rowLimit: 500,
      dimensionFilters: [],
    };

    expect(state.exploreName).toBe('orders');
    expect(state.dimensions).toEqual(['orders_status']);
    expect(state.metrics).toEqual(['orders_amount']);
    expect(state.rowLimit).toBe(500);
    expect(state.dimensionFilters).toEqual([]);
  });
});
