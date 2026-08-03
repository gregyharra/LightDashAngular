import { Routes } from '@angular/router';
import {
  adminGuard,
  authGuard,
  guestGuard,
  resetPasswordGuard,
  setupGuard,
} from './core/guards/auth.guard';
import { canDeactivateGuard } from './core/guards/can-deactivate.guard';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: 'setup',
    canActivate: [setupGuard],
    loadComponent: () =>
      import('./features/auth/setup-page/setup-page.component').then((m) => m.SetupPageComponent),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'reset-password',
    canActivate: [resetPasswordGuard],
    loadComponent: () =>
      import('./features/auth/reset-password-page/reset-password-page.component').then(
        (m) => m.ResetPasswordPageComponent,
      ),
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
        loadComponent: () =>
          import('./features/projects/projects-page/projects-page.component').then(
            (m) => m.ProjectsPageComponent,
          ),
      },
      {
        path: 'projects/create',
        redirectTo: 'settings/projects/create',
      },
      {
        path: 'projects/:projectUuid/edit',
        redirectTo: (route) => `/settings/projects/${route.params['projectUuid']}/edit`,
      },
      {
        path: 'projects/:projectUuid/settings/warehouse',
        redirectTo: (route) => `/settings/projects/${route.params['projectUuid']}/edit`,
      },
      { path: 'warehouses', pathMatch: 'full', redirectTo: 'settings/warehouses' },
      { path: 'warehouses/create', redirectTo: 'settings/warehouses/create' },
      {
        path: 'warehouses/:warehouseUuid/edit',
        redirectTo: (route) => `/settings/warehouses/${route.params['warehouseUuid']}/edit`,
      },
      { path: 'users', redirectTo: 'settings/users' },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings-shell/settings-shell.component').then(
            (m) => m.SettingsShellComponent,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'projects' },
          {
            path: 'projects',
            pathMatch: 'full',
            data: { management: true },
            loadComponent: () =>
              import('./features/projects/projects-page/projects-page.component').then(
                (m) => m.ProjectsPageComponent,
              ),
          },
          {
            path: 'projects/create',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/projects/project-create-page/project-create-page.component').then(
                (m) => m.ProjectCreatePageComponent,
              ),
          },
          {
            path: 'projects/:projectUuid/edit',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/projects/project-edit-page/project-edit-page.component').then(
                (m) => m.ProjectEditPageComponent,
              ),
          },
          {
            path: 'warehouses',
            pathMatch: 'full',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/warehouses/warehouses-page/warehouses-page.component').then(
                (m) => m.WarehousesPageComponent,
              ),
          },
          {
            path: 'warehouses/create',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/warehouses/warehouse-edit-page/warehouse-edit-page.component').then(
                (m) => m.WarehouseEditPageComponent,
              ),
          },
          {
            path: 'warehouses/:warehouseUuid/edit',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/warehouses/warehouse-edit-page/warehouse-edit-page.component').then(
                (m) => m.WarehouseEditPageComponent,
              ),
          },
          {
            path: 'users',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./features/auth/users-page/users-page.component').then(
                (m) => m.UsersPageComponent,
              ),
          },
        ],
      },
      {
        path: 'projects/:projectUuid/dashboards',
        loadComponent: () =>
          import(
            './features/dashboards/dashboards-list-page/dashboards-list-page.component'
          ).then((m) => m.DashboardsListPageComponent),
      },
      {
        path: 'projects/:projectUuid/dashboards/create',
        loadComponent: () =>
          import(
            './features/dashboards/dashboard-create-page/dashboard-create-page.component'
          ).then((m) => m.DashboardCreatePageComponent),
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid/edit',
        redirectTo: (route) =>
          `/projects/${route.params['projectUuid']}/dashboards/${route.params['dashboardUuid']}`,
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid',
        canDeactivate: [canDeactivateGuard],
        loadComponent: () =>
          import(
            './features/dashboards/dashboard-view-page/dashboard-view-page.component'
          ).then((m) => m.DashboardViewPageComponent),
      },
      {
        path: 'projects/:projectUuid/charts',
        loadComponent: () =>
          import(
            './features/charts/charts-list-page/charts-list-page.component'
          ).then((m) => m.ChartsListPageComponent),
      },
      {
        path: 'projects/:projectUuid/charts/new',
        loadComponent: () =>
          import(
            './features/explorer/tables-workspace-page/tables-workspace-page.component'
          ).then((m) => m.TablesWorkspacePageComponent),
      },
      {
        path: 'projects/:projectUuid/charts/:chartUuid',
        loadComponent: () =>
          import(
            './features/charts/chart-view-page/chart-view-page.component'
          ).then((m) => m.ChartViewPageComponent),
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
          import(
            './features/tables/table-hub-page/table-hub-page.component'
          ).then((m) => m.TableHubPageComponent),
      },
      {
        path: 'projects/:projectUuid/tables/:tableId',
        loadComponent: () =>
          import(
            './features/tables/table-hub-page/table-hub-page.component'
          ).then((m) => m.TableHubPageComponent),
      },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
