import { Routes } from '@angular/router';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
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
        path: 'projects/:projectUuid/edit',
        loadComponent: () =>
          import('./features/projects/project-edit-page/project-edit-page.component').then(
            (m) => m.ProjectEditPageComponent,
          ),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'general' },
          {
            path: 'general',
            loadComponent: () =>
              import(
                './features/projects/project-general-tab/project-general-tab.component'
              ).then((m) => m.ProjectGeneralTabComponent),
          },
          {
            path: 'database',
            loadComponent: () =>
              import(
                './features/projects/project-database-tab/project-database-tab.component'
              ).then((m) => m.ProjectDatabaseTabComponent),
          },
        ],
      },
      {
        path: 'projects/:projectUuid/settings/warehouse',
        redirectTo: (route) =>
          `/projects/${route.params['projectUuid']}/edit/database`,
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
        loadComponent: () =>
          import(
            './features/dashboards/dashboard-edit-page/dashboard-edit-page.component'
          ).then((m) => m.DashboardEditPageComponent),
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid',
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
            './features/explorer/tables-workspace-page/tables-workspace-page.component'
          ).then((m) => m.TablesWorkspacePageComponent),
      },
      {
        path: 'projects/:projectUuid/tables/:tableId',
        loadComponent: () =>
          import(
            './features/explorer/tables-workspace-page/tables-workspace-page.component'
          ).then((m) => m.TablesWorkspacePageComponent),
      },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
