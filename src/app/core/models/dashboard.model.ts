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
  filters: {
    dimensions: unknown[];
    metrics: unknown[];
    tableCalculations: unknown[];
  };
  inheritsFromOrgOrProject: boolean;
  access: unknown[] | null;
  colorPaletteUuid: string | null;
  verification: unknown | null;
  config?: {
    isDateZoomDisabled: boolean;
    isAddFilterDisabled?: boolean;
  };
};
