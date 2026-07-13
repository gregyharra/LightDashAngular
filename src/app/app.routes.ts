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
        path: 'projects/:projectUuid/dashboards',
        loadComponent: () =>
          import(
            './features/dashboards/dashboards-list-page/dashboards-list-page.component'
          ).then((m) => m.DashboardsListPageComponent),
      },
      {
        path: 'projects/:projectUuid/dashboards/:dashboardUuid',
        loadComponent: () =>
          import(
            './features/dashboards/dashboard-view-page/dashboard-view-page.component'
          ).then((m) => m.DashboardViewPageComponent),
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
            './features/explorer/explorer-list-page/explorer-list-page.component'
          ).then((m) => m.ExplorerListPageComponent),
      },
      {
        path: 'projects/:projectUuid/tables/:tableId',
        loadComponent: () =>
          import('./features/explorer/explorer-page/explorer-page.component').then(
            (m) => m.ExplorerPageComponent,
          ),
      },
      { path: '**', redirectTo: 'projects' },
    ],
  },
];
