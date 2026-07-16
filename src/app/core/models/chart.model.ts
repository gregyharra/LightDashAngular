import { FieldId, MetricQuery } from './explore.model';

export type ChartKind =
  | 'vertical_bar'
  | 'horizontal_bar'
  | 'line'
  | 'pie'
  | 'table'
  | 'big_number';

export type SavedChartBasic = {
  uuid: string;
  name: string;
  description?: string;
  spaceUuid: string;
  spaceName: string;
  projectUuid: string;
  updatedAt: string;
  pinnedListUuid: string | null;
  pinnedListOrder: number | null;
  views: number;
  firstViewedAt: string;
  isPrivate: boolean;
  access: unknown[];
  chartKind: ChartKind;
  tableName: string;
};

export type ChartConfig = {
  type: ChartKind;
  xField?: FieldId;
  yField?: FieldId;
};

export type SavedChart = SavedChartBasic & {
  tableName: string;
  metricQuery: MetricQuery;
  chartConfig: ChartConfig;
  updatedByUser: {
    userUuid: string;
    firstName: string;
    lastName: string;
  };
};
