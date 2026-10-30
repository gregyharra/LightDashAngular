import { Routes } from '@angular/router';
import { DashboardsListPageComponent } from './dashboards/dashboards-list-page/dashboards-list-page.component';
import { DashboardCreatePageComponent } from './dashboards/dashboard-create-page/dashboard-create-page.component';
import { DashboardViewPageComponent } from './dashboards/dashboard-view-page/dashboard-view-page.component';
import { DashboardsListPageFacade } from './core/facades/dashboards-list-page.facade';
import { DashboardCreatePageFacade } from './core/facades/dashboard-create-page.facade';
import { DashboardViewPageFacade } from './core/facades/dashboard-view-page.facade';

export const DASHBOARDS_LIST_REMOTE_ROUTES: Routes = [
  { path: '', component: DashboardsListPageComponent, providers: [DashboardsListPageFacade] },
];
export const DASHBOARD_CREATE_REMOTE_ROUTES: Routes = [
  { path: '', component: DashboardCreatePageComponent, providers: [DashboardCreatePageFacade] },
];
export const DASHBOARD_VIEW_REMOTE_ROUTES: Routes = [
  { path: '', component: DashboardViewPageComponent, providers: [DashboardViewPageFacade] },
];
export const DASHBOARDS_REMOTE_ROUTES = DASHBOARDS_LIST_REMOTE_ROUTES;
