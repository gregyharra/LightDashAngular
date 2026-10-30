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
      import('@mds-ui/features/auth').then((m) => m.SETUP_REMOTE_ROUTES),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('@mds-ui/features/auth').then((m) => m.LOGIN_REMOTE_ROUTES),
  },
  {
    path: 'reset-password',
    canActivate: [resetPasswordGuard],
    loadChildren: () =>
      import('@mds-ui/features/auth').then((m) => m.RESET_PASSWORD_REMOTE_ROUTES),
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
          import('@mds-ui/features/projects').then(
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
          import('@mds-ui/features/projects').then(
            (m) => m.SettingsShellComponent,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'projects' },
          {
            path: 'projects',
            pathMatch: 'full',
            data: { management: true },
            loadChildren: () =>
              import('@mds-ui/features/projects').then(
                (m) => m.PROJECTS_MANAGEMENT_REMOTE_ROUTES,
              ),
          },
          {
            path: 'projects/create',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('@mds-ui/features/projects').then(
                (m) => m.PROJECT_CREATE_REMOTE_ROUTES,
              ),
          },
          {
            path: 'projects/:projectUuid/edit',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('@mds-ui/features/projects').then(
                (m) => m.PROJECT_EDIT_REMOTE_ROUTES,
              ),
          },
          {
            path: 'warehouses',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('@mds-ui/features/warehouses').then(
                (m) => m.WAREHOUSES_REMOTE_ROUTES,
              ),
          },
          {
            path: 'users',
            canActivate: [adminGuard],
            loadChildren: () =>
              import('@mds-ui/features/auth').then((m) => m.USERS_REMOTE_ROUTES),
          },
        ],
      },
      {
        path: 'projects/:projectUuid/dashboards',
        loadChildren: () =>
          import('remote-dashboards/Routes').then((m) => m.DASHBOARDS_LIST_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/dashboards/create',
        loadChildren: () =>
          import('remote-dashboards/Routes').then((m) => m.DASHBOARD_CREATE_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid/edit',
        redirectTo: (route) =>
          `/projects/${route.params['projectUuid']}/dashboards/${route.params['dashboardUuid']}`,
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid',
        loadChildren: () =>
          import('remote-dashboards/Routes').then((m) => m.DASHBOARD_VIEW_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/explore',
        loadChildren: () =>
          import('remote-explorer/Routes').then((m) => m.EXPLORER_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/explore/:tableId',
        loadChildren: () =>
          import('remote-explorer/Routes').then((m) => m.EXPLORER_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/charts/new',
        data: { createMode: true },
        loadChildren: () =>
          import('remote-charts/Routes').then((m) => m.CHARTS_VIEW_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/charts/:chartUuid',
        loadChildren: () =>
          import('remote-charts/Routes').then((m) => m.CHARTS_VIEW_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/charts',
        pathMatch: 'full',
        loadChildren: () =>
          import('remote-charts/Routes').then((m) => m.CHARTS_LIST_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/lineage',
        loadChildren: () =>
          import('remote-lineage/Routes').then((m) => m.LINEAGE_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/tables',
        loadChildren: () =>
          import('@mds-ui/features/tables').then((m) => m.TABLES_REMOTE_ROUTES),
      },
      {
        path: 'projects/:projectUuid/tables/:tableId',
        loadChildren: () =>
          import('@mds-ui/features/tables').then((m) => m.TABLES_REMOTE_ROUTES),
      },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
