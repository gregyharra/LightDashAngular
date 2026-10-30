import { Routes } from '@angular/router';
import { ChartsListPageComponent } from './charts/charts-list-page/charts-list-page.component';
import { ChartViewPageComponent } from './charts/chart-view-page/chart-view-page.component';
import { ChartsListPageFacade } from './core/facades/charts-list-page.facade';
import { ChartViewPageFacade } from './core/facades/chart-view-page.facade';

export const CHARTS_LIST_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ChartsListPageComponent,
    providers: [ChartsListPageFacade],
  },
];

export const CHARTS_VIEW_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ChartViewPageComponent,
    providers: [ChartViewPageFacade],
  },
];

export const CHARTS_REMOTE_ROUTES = CHARTS_LIST_REMOTE_ROUTES;
