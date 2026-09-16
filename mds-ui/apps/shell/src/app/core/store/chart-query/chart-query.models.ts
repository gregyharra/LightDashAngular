import { BigNumberComparison, ChartConfig } from '../../models/chart.model';
import {
  DashboardDimensionFilter,
  DateZoomGranularity,
} from '../../models/dashboard.model';
import { MetricQuery, QueryResults, TimeTravelConfig } from '../../models/explore.model';

export type ChartQuerySnapshot = {
  queryResults: QueryResults;
  chartConfig?: ChartConfig;
  bigNumberComparison?: BigNumberComparison | null;
};

export type DashboardChartCacheInput = {
  kind: 'dashboardChart';
  projectUuid: string;
  savedChartUuid: string;
  dashboardFilters: DashboardDimensionFilter[];
  dateZoomGranularity: DateZoomGranularity;
  timeTravel: TimeTravelConfig | null;
  bypassCache?: boolean;
};

export type SavedChartViewCacheInput = {
  kind: 'savedChartView';
  projectUuid: string;
  savedChartUuid: string;
  dimensionFilters: DashboardDimensionFilter[];
  bypassCache?: boolean;
};

export type MetricQueryCacheInput = {
  kind: 'metricQuery';
  projectUuid: string;
  metricQuery: MetricQuery;
  dimensionFilters: DashboardDimensionFilter[];
  timeTravel: TimeTravelConfig | null;
  bypassCache?: boolean;
};

export type ChartQueryKeyInput =
  | DashboardChartCacheInput
  | SavedChartViewCacheInput
  | MetricQueryCacheInput;

export type ChartQueryEntryStatus = 'idle' | 'loading' | 'success' | 'error';

export type ChartQueryEntry = {
  status: ChartQueryEntryStatus;
  snapshot?: ChartQuerySnapshot;
  error?: string;
};

export type ChartQueryState = {
  entries: Record<string, ChartQueryEntry>;
};

export const initialChartQueryState: ChartQueryState = {
  entries: {},
};
