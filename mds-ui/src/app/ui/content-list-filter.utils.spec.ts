import {
  SHARED_SPACE_FILTER_VALUE,
  createEmptyDashboardColumnFilters,
  filterDashboards,
  isSharedSpaceFilterValue,
  parseSpaceFilterValue,
  sharedSpaceFilterValue,
  spaceFilterValue,
} from './content-list-filter.utils';

describe('dashboard space filter values', () => {
  it('uses disjoint identities for shared and arbitrarily named spaces', () => {
    const namedValue = spaceFilterValue(SHARED_SPACE_FILTER_VALUE);

    expect(sharedSpaceFilterValue()).toBe(SHARED_SPACE_FILTER_VALUE);
    expect(namedValue).not.toBe(sharedSpaceFilterValue());
    expect(isSharedSpaceFilterValue(sharedSpaceFilterValue())).toBeTrue();
    expect(isSharedSpaceFilterValue(namedValue)).toBeFalse();
    expect(parseSpaceFilterValue(namedValue)).toBe(SHARED_SPACE_FILTER_VALUE);
    expect(parseSpaceFilterValue(sharedSpaceFilterValue())).toBeNull();
  });
});

describe('filterDashboards shared space', () => {
  it('matches only dashboards without a named space for the shared identity', () => {
    const items = [
      { name: 'Shared dashboard', updatedAt: '2024-01-01', views: 1 },
      {
        name: 'Marketing dashboard',
        spaceName: 'Marketing',
        updatedAt: '2024-01-01',
        views: 2,
      },
      {
        name: 'Named shared value',
        spaceName: SHARED_SPACE_FILTER_VALUE,
        updatedAt: '2024-01-01',
        views: 3,
      },
    ];
    const filters = createEmptyDashboardColumnFilters();
    filters.space = { values: [sharedSpaceFilterValue()] };

    const result = filterDashboards(items, filters);

    expect(result.map((item) => item.name)).toEqual(['Shared dashboard']);
  });

  it('treats a space named exactly like the shared value as a named space', () => {
    const items = [
      { name: 'Shared dashboard', updatedAt: '2024-01-01', views: 1 },
      {
        name: 'Named shared value',
        spaceName: SHARED_SPACE_FILTER_VALUE,
        updatedAt: '2024-01-01',
        views: 2,
      },
    ];
    const filters = createEmptyDashboardColumnFilters();
    filters.space = { values: [spaceFilterValue(SHARED_SPACE_FILTER_VALUE)] };

    const result = filterDashboards(items, filters);

    expect(result.map((item) => item.name)).toEqual(['Named shared value']);
  });
});
