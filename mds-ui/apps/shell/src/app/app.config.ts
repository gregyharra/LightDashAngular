import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideRouter } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import localeFr from '@angular/common/locales/fr';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import {
  AppStateService,
  authInterceptor,
  LanguageService,
  MOCK_API_ENABLED,
  mockApiInterceptor,
  provideAppStore,
} from '@mds-ui/core';
import {
  CHART_QUERY_ADAPTER,
  ChartQueryAdapter,
  ChartService,
  ExplorerService,
  applyDashboardContextToMetricQuery,
  mergeDashboardFiltersIntoMetricQuery,
  mergeTimeTravelIntoMetricQuery,
  provideChartQueryState,
} from '@mds-ui/feature-chart-query';

import { routes } from './app.routes';
import { environment } from '../environments/environment';

registerLocaleData(localeFr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    {
      provide: CHART_QUERY_ADAPTER,
      useFactory: (): ChartQueryAdapter => {
        const chartService = inject(ChartService);
        const explorerService = inject(ExplorerService);

        return {
          getChart: (projectUuid, chartUuid) =>
            chartService.get(projectUuid, chartUuid),
          getExplore: (projectUuid, tableId) =>
            explorerService.getExplore(projectUuid, tableId),
          runQuery: (projectUuid, metricQuery, options) =>
            explorerService.runQuery(projectUuid, metricQuery, options),
          applyDashboardContext: applyDashboardContextToMetricQuery,
          mergeDashboardFilters: mergeDashboardFiltersIntoMetricQuery,
          mergeTimeTravel: mergeTimeTravelIntoMetricQuery,
        };
      },
    },
    provideAppStore(),
    provideChartQueryState(),
    provideRouter(routes),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    { provide: MOCK_API_ENABLED, useValue: environment.useMockApi },
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        enterAnimationDuration: '0ms',
        exitAnimationDuration: '0ms',
        autoFocus: 'first-tabbable',
      },
    },
    provideHttpClient(withFetch(), withInterceptors([mockApiInterceptor, authInterceptor])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/assets/i18n/',
        suffix: '.json',
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    provideAppInitializer(() => inject(LanguageService).init()),
    provideAppInitializer(() => inject(AppStateService).bootstrap()),
  ],
};
