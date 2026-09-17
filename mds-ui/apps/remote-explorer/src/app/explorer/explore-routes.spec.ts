import { explorePath, exploreRootPath } from './explore-routes';

describe('explore-routes', () => {
  it('explorePath builds table workspace route segments', () => {
    expect(explorePath('proj-1', 'orders')).toEqual([
      '/projects',
      'proj-1',
      'explore',
      'orders',
    ]);
  });

  it('exploreRootPath builds explore picker route segments', () => {
    expect(exploreRootPath('proj-1')).toEqual([
      '/projects',
      'proj-1',
      'explore',
    ]);
  });
});
