import { Route } from '@angular/router';
import { routes } from './app.routes';

function flattenPaths(rs: Route[]): string[] {
  return rs.flatMap((route) => [
    ...(route.path != null ? [route.path] : []),
    ...(route.children ? flattenPaths(route.children) : []),
  ]);
}

describe('app.routes', () => {
  it('registers explore picker and workspace as chart siblings', () => {
    const paths = flattenPaths(routes);
    expect(paths).toContain('projects/:projectUuid/explore');
    expect(paths).toContain('projects/:projectUuid/explore/:tableId');
  });
});
