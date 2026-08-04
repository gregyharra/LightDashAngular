import {
  SavedChart,
  SavedChartBasic,
  ChartConfig,
  ChartKind,
  normalizeChartConfig,
} from '../../models/chart.model';
import { MetricQuery } from '../../models/explore.model';
import {
  MOCK_CHART_2_UUID,
  MOCK_CHART_3_UUID,
  MOCK_CHART_4_UUID,
  MOCK_CHART_5_UUID,
  MOCK_CHART_6_UUID,
  MOCK_CHART_7_UUID,
  MOCK_CHART_8_UUID,
  MOCK_CHART_UUID,
  MOCK_PROJECT_UUID,
  MOCK_SPACE_UUID,
  MOCK_USER_UUID,
} from './ids.fixture';
import { getFieldId } from '../../models/explore.model';
import { createUuid } from '../../utils/uuid';

const SPACE_NAMES: Record<string, string> = {
  [MOCK_SPACE_UUID]: 'Shared',
  'f6a7b8c9-d0e1-2345-f012-456789012345': 'Private',
};

function resolveSpaceName(spaceUuid: string): string {
  return SPACE_NAMES[spaceUuid] ?? 'Shared';
}

const revenueByMonthQuery = {
  exploreName: 'orders',
  dimensions: [getFieldId('orders', 'order_date')],
  metrics: [getFieldId('orders', 'total_revenue')],
  filters: {},
  sorts: [{ fieldId: getFieldId('orders', 'order_date'), descending: false }],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

const ordersTrendQuery = {
  exploreName: 'orders',
  dimensions: [getFieldId('orders', 'order_date')],
  metrics: [getFieldId('orders', 'order_count')],
  filters: {},
  sorts: [{ fieldId: getFieldId('orders', 'order_date'), descending: false }],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

const statusBreakdownQuery = {
  exploreName: 'orders',
  dimensions: [getFieldId('orders', 'status')],
  metrics: [getFieldId('orders', 'total_revenue')],
  filters: {},
  sorts: [{ fieldId: getFieldId('orders', 'total_revenue'), descending: true }],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

const ordersTableQuery = {
  exploreName: 'orders',
  dimensions: [
    getFieldId('orders', 'order_date'),
    getFieldId('orders', 'status'),
  ],
  metrics: [
    getFieldId('orders', 'order_count'),
    getFieldId('orders', 'total_revenue'),
  ],
  filters: {},
  sorts: [{ fieldId: getFieldId('orders', 'order_date'), descending: true }],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

/** Post-migration ChartConfig shapes (cartesian / pie / table / big_number). */
const revenueByMonthConfig = normalizeChartConfig({
  type: 'cartesian',
  config: {
    layout: {
      cartesianKind: 'line',
      xField: getFieldId('orders', 'order_date'),
      yFields: [getFieldId('orders', 'total_revenue')],
      flipAxes: false,
    },
    seriesColor: '#e67700',
    showValueLabels: true,
    showLegend: false,
  },
});

const ordersTrendConfig = normalizeChartConfig({
  type: 'cartesian',
  config: {
    layout: {
      cartesianKind: 'line',
      xField: getFieldId('orders', 'order_date'),
      yFields: [getFieldId('orders', 'order_count')],
      flipAxes: false,
    },
    seriesColor: '#12b886',
    showValueLabels: true,
    showLegend: false,
  },
});

const revenueByStatusBarConfig = normalizeChartConfig({
  type: 'cartesian',
  config: {
    layout: {
      cartesianKind: 'vertical_bar',
      xField: getFieldId('orders', 'status'),
      yFields: [getFieldId('orders', 'total_revenue')],
      flipAxes: false,
    },
    showLegend: false,
  },
});

const statusBreakdownConfig = normalizeChartConfig({
  type: 'pie',
  config: {
    xField: getFieldId('orders', 'status'),
    yField: getFieldId('orders', 'total_revenue'),
  },
});

const ordersTableConfig = normalizeChartConfig({
  type: 'table',
  config: {
    showTableNames: false,
    showColumnTotals: true,
  },
});

const bigNumberOrderCountConfig = normalizeChartConfig({
  type: 'big_number',
  config: {
    selectedField: getFieldId('orders', 'order_count'),
  },
});

const bigNumberRevenueConfig = normalizeChartConfig({
  type: 'big_number',
  config: {
    selectedField: getFieldId('orders', 'total_revenue'),
  },
});


export const mockSavedChartDetails: Record<string, SavedChart> = {
  [MOCK_CHART_UUID]: {
    uuid: MOCK_CHART_UUID,
    name: 'Revenue by month',
    description: 'Monthly revenue trend from order amounts',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-05-20T09:30:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 18,
    firstViewedAt: '2024-02-01T10:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'line',
    tableName: 'orders',
    metricQuery: revenueByMonthQuery,
    chartConfig: revenueByMonthConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
  [MOCK_CHART_2_UUID]: {
    uuid: MOCK_CHART_2_UUID,
    name: 'Orders trend',
    description: 'Order volume over time',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-05-10T14:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 24,
    firstViewedAt: '2024-02-15T10:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'line',
    tableName: 'orders',
    metricQuery: ordersTrendQuery,
    chartConfig: ordersTrendConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
  [MOCK_CHART_3_UUID]: {
    uuid: MOCK_CHART_3_UUID,
    name: 'Revenue by status',
    description: 'Revenue breakdown by order status',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-04-28T11:15:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 9,
    firstViewedAt: '2024-03-10T08:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'pie',
    tableName: 'orders',
    metricQuery: statusBreakdownQuery,
    chartConfig: statusBreakdownConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
  [MOCK_CHART_4_UUID]: {
    uuid: MOCK_CHART_4_UUID,
    name: 'How many orders have we fulfilled??',
    description: 'Total fulfilled orders',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-06-01T10:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 31,
    firstViewedAt: '2024-02-01T10:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'big_number',
    tableName: 'orders',
    metricQuery: {
      exploreName: 'orders',
      dimensions: [],
      metrics: [getFieldId('orders', 'order_count')],
      filters: {},
      sorts: [],
      limit: 1,
      tableCalculations: [],
      additionalMetrics: [],
    },
    chartConfig: bigNumberOrderCountConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
  [MOCK_CHART_5_UUID]: {
    uuid: MOCK_CHART_5_UUID,
    name: 'What is our total revenue this month?',
    description: 'Total revenue KPI',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-06-01T10:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 28,
    firstViewedAt: '2024-02-01T10:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'big_number',
    tableName: 'orders',
    metricQuery: {
      exploreName: 'orders',
      dimensions: [],
      metrics: [getFieldId('orders', 'total_revenue')],
      filters: {},
      sorts: [],
      limit: 1,
      tableCalculations: [],
      additionalMetrics: [],
    },
    chartConfig: bigNumberRevenueConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
  [MOCK_CHART_6_UUID]: {
    uuid: MOCK_CHART_6_UUID,
    name: 'What is our total profit?',
    description: 'Total profit KPI',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-06-01T10:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 25,
    firstViewedAt: '2024-02-01T10:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'big_number',
    tableName: 'orders',
    metricQuery: {
      exploreName: 'orders',
      dimensions: [],
      metrics: [getFieldId('orders', 'total_revenue')],
      filters: {},
      sorts: [],
      limit: 1,
      tableCalculations: [],
      additionalMetrics: [],
    },
    chartConfig: bigNumberRevenueConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
  [MOCK_CHART_7_UUID]: {
    uuid: MOCK_CHART_7_UUID,
    name: 'Revenue by status (bar)',
    description: 'Vertical bar breakdown of revenue by order status',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-06-02T11:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 12,
    firstViewedAt: '2024-03-01T10:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'vertical_bar',
    tableName: 'orders',
    metricQuery: statusBreakdownQuery,
    chartConfig: revenueByStatusBarConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
  [MOCK_CHART_8_UUID]: {
    uuid: MOCK_CHART_8_UUID,
    name: 'Orders detail table',
    description: 'Tabular view of orders by date and status',
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    projectUuid: MOCK_PROJECT_UUID,
    updatedAt: '2024-06-02T12:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 7,
    firstViewedAt: '2024-03-15T10:00:00.000Z',
    isPrivate: false,
    access: [],
    chartKind: 'table',
    tableName: 'orders',
    metricQuery: ordersTableQuery,
    chartConfig: ordersTableConfig,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  },
};

export const mockSavedChartsList: SavedChartBasic[] = Object.values(
  mockSavedChartDetails,
).map(
  ({
    uuid,
    name,
    description,
    spaceUuid,
    spaceName,
    projectUuid,
    updatedAt,
    pinnedListUuid,
    pinnedListOrder,
    views,
    firstViewedAt,
    isPrivate,
    access,
    chartKind,
    tableName,
  }) => ({
    uuid,
    name,
    description,
    spaceUuid,
    spaceName,
    projectUuid,
    updatedAt,
    pinnedListUuid,
    pinnedListOrder,
    views,
    firstViewedAt,
    isPrivate,
    access,
    chartKind,
    tableName,
  }),
);

export type CreateMockSavedChartInput = {
  name: string;
  description?: string;
  projectUuid: string;
  spaceUuid?: string;
  tableName: string;
  chartKind: ChartKind;
  metricQuery: MetricQuery;
  chartConfig: ChartConfig;
};

export function createMockSavedChart(input: CreateMockSavedChartInput): SavedChart {
  const uuid = createUuid();
  const spaceUuid = input.spaceUuid ?? MOCK_SPACE_UUID;
  const now = new Date().toISOString();

  const chart: SavedChart = {
    uuid,
    name: input.name,
    description: input.description,
    spaceUuid,
    spaceName: resolveSpaceName(spaceUuid),
    projectUuid: input.projectUuid,
    updatedAt: now,
    pinnedListUuid: null,
    pinnedListOrder: null,
    views: 0,
    firstViewedAt: now,
    isPrivate: false,
    access: [],
    chartKind: input.chartKind,
    tableName: input.tableName,
    metricQuery: input.metricQuery,
    chartConfig: normalizeChartConfig(input.chartConfig),
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
  };

  mockSavedChartDetails[uuid] = chart;
  mockSavedChartsList.unshift({
    uuid: chart.uuid,
    name: chart.name,
    description: chart.description,
    spaceUuid: chart.spaceUuid,
    spaceName: chart.spaceName,
    projectUuid: chart.projectUuid,
    updatedAt: chart.updatedAt,
    pinnedListUuid: chart.pinnedListUuid,
    pinnedListOrder: chart.pinnedListOrder,
    views: chart.views,
    firstViewedAt: chart.firstViewedAt,
    isPrivate: chart.isPrivate,
    access: chart.access,
    chartKind: chart.chartKind,
    tableName: chart.tableName,
  });

  return chart;
}

export type UpdateMockSavedChartInput = {
  name?: string;
  description?: string;
  spaceUuid?: string;
  tableName?: string;
  chartKind?: ChartKind;
  metricQuery?: MetricQuery;
  chartConfig?: ChartConfig;
};

export function updateMockSavedChart(
  chartUuid: string,
  input: UpdateMockSavedChartInput,
): SavedChart | null {
  const existing = mockSavedChartDetails[chartUuid];
  if (!existing) {
    return null;
  }

  const spaceUuid = input.spaceUuid ?? existing.spaceUuid;
  const updated: SavedChart = {
    ...existing,
    name: input.name?.trim() || existing.name,
    description:
      input.description !== undefined
        ? input.description.trim() || undefined
        : existing.description,
    spaceUuid,
    spaceName: resolveSpaceName(spaceUuid),
    tableName: input.tableName ?? existing.tableName,
    chartKind: input.chartKind ?? existing.chartKind,
    metricQuery: input.metricQuery ?? existing.metricQuery,
    chartConfig:
      input.chartConfig !== undefined
        ? normalizeChartConfig(input.chartConfig)
        : existing.chartConfig,
    updatedAt: new Date().toISOString(),
  };

  mockSavedChartDetails[chartUuid] = updated;
  const listIndex = mockSavedChartsList.findIndex((c) => c.uuid === chartUuid);
  if (listIndex >= 0) {
    mockSavedChartsList[listIndex] = {
      uuid: updated.uuid,
      name: updated.name,
      description: updated.description,
      spaceUuid: updated.spaceUuid,
      spaceName: updated.spaceName,
      projectUuid: updated.projectUuid,
      updatedAt: updated.updatedAt,
      pinnedListUuid: updated.pinnedListUuid,
      pinnedListOrder: updated.pinnedListOrder,
      views: updated.views,
      firstViewedAt: updated.firstViewedAt,
      isPrivate: updated.isPrivate,
      access: updated.access,
      chartKind: updated.chartKind,
      tableName: updated.tableName,
    };
  }

  return updated;
}

export function deleteMockSavedChart(chartUuid: string): boolean {
  if (!mockSavedChartDetails[chartUuid]) {
    return false;
  }
  delete mockSavedChartDetails[chartUuid];
  const listIndex = mockSavedChartsList.findIndex((c) => c.uuid === chartUuid);
  if (listIndex >= 0) {
    mockSavedChartsList.splice(listIndex, 1);
  }
  return true;
}
