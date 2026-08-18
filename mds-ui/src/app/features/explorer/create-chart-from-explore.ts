import { DashboardDimensionFilter } from '../../core/models/dashboard.model';
import {
  AdditionalMetric,
  FieldId,
  MetricQueryFilter,
  TimeTravelConfig,
} from '../../core/models/explore.model';

export const CREATE_FROM_EXPLORE_STATE_KEY = 'createFromExplore';

export type CreateChartFromExploreState = {
  exploreName: string;
  dimensions: FieldId[];
  metrics: FieldId[];
  filters: MetricQueryFilter;
  sorts: { fieldId: FieldId; descending: boolean }[];
  additionalMetrics: AdditionalMetric[];
  rowLimit: number;
  timeTravel?: TimeTravelConfig | null;
  dimensionFilters: DashboardDimensionFilter[];
};
