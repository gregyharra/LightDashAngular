import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  guestGuard,
  resetPasswordGuard,
  setupGuard,
} from '@mds-ui/core';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadChildren: () =>
      import('remote-auth/Routes').then((m) => m.SETUP_REMOTE_ROUTES),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('remote-auth/Routes').then((m) => m.LOGIN_REMOTE_ROUTES),
  },
  {
    path: 'reset-password',
    canActivate: [resetPasswordGuard],
    loadChildren: () =>
      import('remote-auth/Routes').then((m) => m.RESET_PASSWORD_REMOTE_ROUTES),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'projects' },
      {
        path: 'projects',
        pathMatch: 'full',
        loadChildren: () =>
          import('remote-projects/Routes').then(
            (m) => m.PROJECTS_REMOTE_ROUTES,
          ),
      },
      {
        path: 'projects/create',
        redirectTo: 'settings/projects/create',
      },
      {
        path: 'projects/:projectUuid/edit',
        redirectTo: (route) =>
          `/settings/projects/${route.params['projectUuid']}/edit`,
      },
      {
        path: 'projects/:projectUuid/settings/warehouse',
        redirectTo: (route) =>
          `/settings/projects/${route.params['projectUuid']}/edit`,
      },
      {
        path: 'warehouses',
        pathMatch: 'full',
        redirectTo: 'settings/warehouses',
      },
      { path: 'warehouses/create', redirectTo: 'settings/warehouses/create' },
      {
        path: 'warehouses/:warehouseUuid/edit',
        redirectTo: (route) =>
          `/settings/warehouses/${route.params['warehouseUuid']}/edit`,
      },
      { path: 'users', redirectTo: 'settings/users' },
      {
        path: 'settings',
        loadComponent: () =>
          import('remote-projects/Routes').then(
            (m) => m.SettingsShellComponent,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'projects' },
          {
            path: 'projects',
            pathMatch: 'full',
            data: { management: true },
            loadChildren: () =>
              import('remote-projects/Routes').then(
                (m) => m.PROJECTS_MANAGEMENT_REMOTE_ROUTES,
              ),
          },
          {
            path: 'projects/create',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('remote-projects/Routes').then(
                (m) => m.PROJECT_CREATE_REMOTE_ROUTES,
              ),
          },
          {
            path: 'projects/:projectUuid/edit',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('remote-projects/Routes').then(
                (m) => m.PROJECT_EDIT_REMOTE_ROUTES,
              ),
          },
          {
            path: 'warehouses',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('remote-warehouses/Routes').then(
                (m) => m.WAREHOUSES_REMOTE_ROUTES,
              ),
          },
          {
            path: 'users',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('remote-auth/Routes').then((m) => m.USERS_REMOTE_ROUTES),
          },
        ],
      },
      {
        path: 'projects/:projectUuid/dashboards',
        loadComponent: () =>
          import('./features/dashboards/dashboards-list-page/dashboards-list-page.component').then(
            (m) => m.DashboardsListPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/dashboards/create',
        loadComponent: () =>
          import('./features/dashboards/dashboard-create-page/dashboard-create-page.component').then(
            (m) => m.DashboardCreatePageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid/edit',
        redirectTo: (route) =>
          `/projects/${route.params['projectUuid']}/dashboards/${route.params['dashboardUuid']}`,
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid',
        loadComponent: () =>
          import('./features/dashboards/dashboard-view-page/dashboard-view-page.component').then(
            (m) => m.DashboardViewPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/explore',
        loadComponent: () =>
          import('./features/explorer/explorer-page/explorer-page.component').then(
            (m) => m.ExplorerPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/explore/:tableId',
        loadComponent: () =>
          import('./features/explorer/explorer-page/explorer-page.component').then(
            (m) => m.ExplorerPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/charts/new',
        data: { createMode: true },
        loadComponent: () =>
          import('./features/charts/chart-view-page/chart-view-page.component').then(
            (m) => m.ChartViewPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/charts/:chartUuid',
        loadComponent: () =>
          import('./features/charts/chart-view-page/chart-view-page.component').then(
            (m) => m.ChartViewPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/charts',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/charts/charts-list-page/charts-list-page.component').then(
            (m) => m.ChartsListPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/lineage',
        loadComponent: () =>
          import('./features/lineage/lineage-page/lineage-page.component').then(
            (m) => m.LineagePageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/tables',
        loadComponent: () =>
          import('./features/tables/table-hub-page/table-hub-page.component').then(
            (m) => m.TableHubPageComponent,
          ),
      },
      {
        path: 'projects/:projectUuid/tables/:tableId',
        loadComponent: () =>
          import('./features/tables/table-hub-page/table-hub-page.component').then(
            (m) => m.TableHubPageComponent,
          ),
      },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
