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

export type ChartStackMode = 'none' | 'stack' | 'percent';

export type ChartLegendPlacement = 'chart' | 'outside-right' | 'outside-left';

export type ChartDisplayConfig = {
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  showGridX: boolean;
  showGridY: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
  flipAxes: boolean;
  stackMode: ChartStackMode;
  rowLimit: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  showTableNames: boolean;
  showColumnTotals: boolean;
  seriesColor?: string;
  showValueLabels?: boolean;
};

export type BigNumberComparison = {
  label: string;
  direction: 'up' | 'down' | 'neutral';
};

export const DEFAULT_CHART_DISPLAY_CONFIG: ChartDisplayConfig = {
  showLegend: true,
  legendPlacement: 'chart',
  showGridX: true,
  showGridY: true,
  showXAxis: true,
  showYAxis: true,
  xAxisLabel: '',
  yAxisLabel: '',
  flipAxes: false,
  stackMode: 'none',
  rowLimit: 500,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  showTableNames: true,
  showColumnTotals: false,
};

export type ChartConfig = {
  type: ChartKind;
  xField?: FieldId;
  yField?: FieldId;
  yFields?: FieldId[];
  displayConfig?: Partial<ChartDisplayConfig>;
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

export type CreateSavedChartPayload = {
  name: string;
  description?: string;
  spaceUuid?: string;
  tableName: string;
  chartKind: ChartKind;
  metricQuery: MetricQuery;
  chartConfig: ChartConfig;
};

export type UpdateSavedChartPayload = {
  name?: string;
  description?: string;
  spaceUuid?: string;
  tableName?: string;
  chartKind?: ChartKind;
  metricQuery?: MetricQuery;
  chartConfig?: ChartConfig;
};
