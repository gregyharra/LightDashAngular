import {
  SHARED_SPACE_SENTINEL,
  createEmptyDashboardColumnFilters,
  filterDashboards,
} from './content-list-filter.utils';

describe('SHARED_SPACE_SENTINEL', () => {
  it('does not collide with a real space named __shared__', () => {
    expect(SHARED_SPACE_SENTINEL).not.toBe('__shared__');
    expect('__shared__'.includes('\u0000')).toBeFalse();
  });
});

describe('filterDashboards shared space', () => {
  it('matches only dashboards without spaceName when filtering by sentinel', () => {
    const items = [
      { name: 'Shared dashboard', updatedAt: '2024-01-01', views: 1 },
      { name: 'Marketing dashboard', spaceName: 'Marketing', updatedAt: '2024-01-01', views: 2 },
      { name: 'Named __shared__', spaceName: '__shared__', updatedAt: '2024-01-01', views: 3 },
    ];
    const filters = createEmptyDashboardColumnFilters();
    filters.space = { values: [SHARED_SPACE_SENTINEL] };

    const result = filterDashboards(items, filters, SHARED_SPACE_SENTINEL);

    expect(result.map((item) => item.name)).toEqual(['Shared dashboard']);
  });
});
