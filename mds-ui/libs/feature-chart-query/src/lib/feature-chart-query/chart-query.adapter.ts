import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import {
  DashboardDimensionFilter,
  Explore,
  MetricQuery,
  QueryResults,
  SavedChart,
  TimeTravelConfig,
} from '@mds-ui/models';

export interface ChartQueryAdapter {
  getChart(projectUuid: string, chartUuid: string): Observable<SavedChart>;
  getExplore(projectUuid: string, tableId: string): Observable<Explore>;
  runQuery(
    projectUuid: string,
    metricQuery: MetricQuery,
    options?: { bypassCache?: boolean },
  ): Observable<QueryResults>;
  applyDashboardContext(
    metricQuery: MetricQuery,
    filters: DashboardDimensionFilter[],
    timeTravel: TimeTravelConfig | null | undefined,
    explore: Explore,
  ): MetricQuery;
  mergeDashboardFilters(
    metricQuery: MetricQuery,
    filters: DashboardDimensionFilter[],
    explore: Explore,
  ): MetricQuery;
  mergeTimeTravel(
    metricQuery: MetricQuery,
    timeTravel: TimeTravelConfig | null | undefined,
  ): MetricQuery;
}

export const CHART_QUERY_ADAPTER = new InjectionToken<ChartQueryAdapter>(
  'CHART_QUERY_ADAPTER',
);
