export enum DashboardTileTypes {
  SAVED_CHART = 'saved_chart',
  SQL_CHART = 'sql_chart',
  MARKDOWN = 'markdown',
  LOOM = 'loom',
  HEADING = 'heading',
  DATA_APP = 'data_app',
}

export type DashboardBasicDetails = {
  uuid: string;
  name: string;
  description?: string;
  projectUuid: string;
  organizationUuid: string;
  spaceUuid: string;
  spaceName?: string;
  updatedAt: string;
  updatedByUser?: {
    userUuid: string;
    firstName: string;
    lastName: string;
  };
  views: number;
  firstViewedAt: string | null;
  pinnedListUuid: string | null;
  pinnedListOrder: number | null;
  isPrivate?: boolean;
  access?: unknown[];
  verification?: unknown | null;
};

export type DashboardBasicDetailsWithTileTypes = DashboardBasicDetails & {
  tileTypes: DashboardTileTypes[];
};

export type DashboardTab = {
  uuid: string;
  name: string;
  order: number;
  hidden?: boolean;
};

export type DashboardTileBase = {
  uuid: string;
  type: DashboardTileTypes;
  x: number;
  y: number;
  h: number;
  w: number;
  tabUuid: string | null;
};

export type DashboardChartTile = DashboardTileBase & {
  type: DashboardTileTypes.SAVED_CHART;
  properties: {
    title?: string;
    hideTitle?: boolean;
    savedChartUuid: string | null;
    chartName?: string | null;
    lastVersionChartKind?: string | null;
  };
};

export type DashboardMarkdownTile = DashboardTileBase & {
  type: DashboardTileTypes.MARKDOWN;
  properties: {
    title: string;
    content: string;
    hideFrame?: boolean;
  };
};

export type DashboardHeadingTile = DashboardTileBase & {
  type: DashboardTileTypes.HEADING;
  properties: {
    text: string;
    showDivider?: boolean;
  };
};

export type DashboardTile =
  | DashboardChartTile
  | DashboardMarkdownTile
  | DashboardHeadingTile;

export type CreateDashboardPayload = {
  name: string;
  description?: string;
  spaceUuid?: string;
  tabs?: DashboardTab[];
  tiles?: DashboardTile[];
};

export type UpdateDashboardPayload = {
  name?: string;
  description?: string;
  tabs?: DashboardTab[];
  tiles?: DashboardTile[];
};

export type DashboardFilterOperator =
  | 'equals'
  | 'notEquals'
  | 'isNull'
  | 'notNull'
  | 'startsWith'
  | 'endsWith'
  | 'include'
  | 'doesNotInclude'
  | 'lessThan'
  | 'lessThanOrEqual'
  | 'greaterThan'
  | 'greaterThanOrEqual'
  | 'inThePast'
  | 'notInThePast'
  | 'inTheNext'
  | 'inTheCurrent'
  | 'notInTheCurrent'
  | 'inBetween'
  | 'notInBetween';

export type DashboardFilterUnitOfTime =
  | 'days'
  | 'weeks'
  | 'months'
  | 'quarters'
  | 'years';

export type DashboardFilterTarget = {
  fieldId: string;
  tableName: string;
};

export type DashboardFilterSettings = {
  completed?: boolean;
  unitOfTime?: DashboardFilterUnitOfTime;
};

export type DashboardDimensionFilter = {
  id: string;
  label: string;
  operator: DashboardFilterOperator;
  target: DashboardFilterTarget;
  values: unknown[];
  disabled?: boolean;
  required?: boolean;
  singleValue?: boolean;
  settings?: DashboardFilterSettings;
  tileTargets?: Record<string, DashboardFilterTarget | false>;
};

export type DashboardFilters = {
  dimensions: DashboardDimensionFilter[];
  metrics: unknown[];
  tableCalculations: unknown[];
};

export type DateZoomGranularity =
  | 'Day'
  | 'Week'
  | 'Month'
  | 'Quarter'
  | 'Year';

export type DashboardConfig = {
  isDateZoomDisabled: boolean;
  isAddFilterDisabled?: boolean;
  dateZoomGranularities?: DateZoomGranularity[];
  defaultDateZoomGranularity?: DateZoomGranularity;
  pinnedParameters?: string[];
};

export type Dashboard = {
  uuid: string;
  name: string;
  description?: string;
  slug: string;
  projectUuid: string;
  organizationUuid: string;
  spaceUuid: string;
  spaceName: string;
  dashboardVersionId: number;
  versionUuid: string;
  updatedAt: string;
  updatedByUser?: {
    userUuid: string;
    firstName: string;
    lastName: string;
  };
  views: number;
  firstViewedAt: string | null;
  pinnedListUuid: string | null;
  pinnedListOrder: number | null;
  tiles: DashboardTile[];
  tabs: DashboardTab[];
  filters: DashboardFilters;
  inheritsFromOrgOrProject: boolean;
  access: unknown[] | null;
  colorPaletteUuid: string | null;
  verification: unknown | null;
  config?: DashboardConfig;
};
