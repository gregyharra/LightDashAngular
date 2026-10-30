import { Routes } from '@angular/router';
import { provideFeatureTranslations } from '@mds-ui/core';
import { ChartsListPageComponent } from './charts/charts-list-page/charts-list-page.component';
import { ChartViewPageComponent } from './charts/chart-view-page/chart-view-page.component';
import { ChartsListPageFacade } from './core/facades/charts-list-page.facade';
import { ChartViewPageFacade } from './core/facades/chart-view-page.facade';

export const CHARTS_LIST_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ChartsListPageComponent,
    providers: [...provideFeatureTranslations('charts'), ChartsListPageFacade],
  },
];

export const CHARTS_VIEW_REMOTE_ROUTES: Routes = [
  {
    path: '',
    component: ChartViewPageComponent,
    providers: [...provideFeatureTranslations('charts'), ChartViewPageFacade],
  },
];

export const CHARTS_REMOTE_ROUTES = CHARTS_LIST_REMOTE_ROUTES;
