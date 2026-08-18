import {
  ChartQueryKeyInput,
  DashboardChartCacheInput,
  MetricQueryCacheInput,
  SavedChartViewCacheInput,
} from './chart-query.models';
import { DashboardDimensionFilter } from '../../models/dashboard.model';
import { MetricQuery } from '../../models/explore.model';

function normalizeFilters(filters: DashboardDimensionFilter[]) {
  return filters.map((filter) => ({
    id: filter.id,
    operator: filter.operator,
    values: filter.values,
    disabled: filter.disabled ?? false,
    target: filter.target,
  }));
}

function normalizeMetricQuery(metricQuery: MetricQuery) {
  return {
    exploreName: metricQuery.exploreName,
    dimensions: [...metricQuery.dimensions].sort(),
    metrics: [...metricQuery.metrics].sort(),
    filters: metricQuery.filters,
    sorts: metricQuery.sorts,
    limit: metricQuery.limit,
    tableCalculations: metricQuery.tableCalculations,
    additionalMetrics: metricQuery.additionalMetrics.map((metric) => ({
      name: metric.name,
      tableName: metric.tableName,
      label: metric.label,
      baseDimensionName: metric.baseDimensionName,
      expr: metric.expr,
    })),
  };
}

function dashboardChartCacheKey(input: DashboardChartCacheInput): string {
  return JSON.stringify({
    kind: input.kind,
    projectUuid: input.projectUuid,
    savedChartUuid: input.savedChartUuid,
    dateZoomGranularity: input.dateZoomGranularity,
    timeTravel: input.timeTravel ?? null,
    dashboardFilters: normalizeFilters(input.dashboardFilters),
  });
}

function savedChartViewCacheKey(input: SavedChartViewCacheInput): string {
  return JSON.stringify({
    kind: input.kind,
    projectUuid: input.projectUuid,
    savedChartUuid: input.savedChartUuid,
    dimensionFilters: normalizeFilters(input.dimensionFilters),
  });
}

function metricQueryCacheKey(input: MetricQueryCacheInput): string {
  return JSON.stringify({
    kind: input.kind,
    projectUuid: input.projectUuid,
    metricQuery: normalizeMetricQuery(input.metricQuery),
    dimensionFilters: normalizeFilters(input.dimensionFilters),
    timeTravel: input.timeTravel ?? null,
  });
}

export function chartQueryKey(input: ChartQueryKeyInput): string {
  switch (input.kind) {
    case 'dashboardChart':
      return dashboardChartCacheKey(input);
    case 'savedChartView':
      return savedChartViewCacheKey(input);
    case 'metricQuery':
      return metricQueryCacheKey(input);
  }
}

/** @deprecated Use chartQueryKey */
export const dashboardChartTileCacheKey = chartQueryKey;
