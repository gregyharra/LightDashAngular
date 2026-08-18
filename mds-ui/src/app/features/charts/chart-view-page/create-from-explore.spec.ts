import { Router } from '@angular/router';
import { readCreateFromExploreState } from '../../explorer/create-chart-from-explore';

describe('readCreateFromExploreState', () => {
  it('returns null when navigation has no extras', () => {
    const router = { getCurrentNavigation: () => null } as Router;
    expect(readCreateFromExploreState(router)).toBeNull();
  });

  it('reads createFromExplore from current navigation state', () => {
    const state = {
      exploreName: 'orders',
      dimensions: ['orders_status'],
      metrics: [],
      filters: {},
      sorts: [],
      additionalMetrics: [],
      rowLimit: 500,
      dimensionFilters: [],
    };
    const router = {
      getCurrentNavigation: () => ({
        extras: { state: { createFromExplore: state } },
      }),
    } as unknown as Router;
    expect(readCreateFromExploreState(router)?.exploreName).toBe('orders');
  });
});
