import {
  Dashboard,
  DashboardBasicDetailsWithTileTypes,
  DashboardTab,
  DashboardTile,
  DashboardTileTypes,
} from '../../models/dashboard.model';
import {
  MOCK_CHART_2_UUID,
  MOCK_CHART_3_UUID,
  MOCK_CHART_4_UUID,
  MOCK_CHART_5_UUID,
  MOCK_CHART_6_UUID,
  MOCK_CHART_UUID,
  MOCK_DASHBOARD_2_UUID,
  MOCK_DASHBOARD_UUID,
  MOCK_ORG_UUID,
  MOCK_PROJECT_UUID,
  MOCK_SPACE_UUID,
  MOCK_USER_UUID,
} from './ids.fixture';

const MOCK_TAB_UUID = 'a1a1a1a1-b1b1-4c1c-d1d1-e1e1e1e1e1e1';

const SPACE_NAMES: Record<string, string> = {
  [MOCK_SPACE_UUID]: 'Shared',
  'f6a7b8c9-d0e1-2345-f012-456789012345': 'Private',
};

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'dashboard'
  );
}

function resolveSpaceName(spaceUuid: string): string {
  return SPACE_NAMES[spaceUuid] ?? 'Shared';
}

export type CreateMockDashboardInput = {
  name: string;
  description?: string;
  projectUuid: string;
  spaceUuid?: string;
};

export function createMockDashboard(input: CreateMockDashboardInput): Dashboard {
  const uuid = crypto.randomUUID();
  const tabUuid = crypto.randomUUID();
  const spaceUuid = input.spaceUuid ?? MOCK_SPACE_UUID;
  const now = new Date().toISOString();

  const dashboard: Dashboard = {
    uuid,
    name: input.name,
    description: input.description,
    slug: slugify(input.name),
    projectUuid: input.projectUuid,
    organizationUuid: MOCK_ORG_UUID,
    spaceUuid,
    spaceName: resolveSpaceName(spaceUuid),
    dashboardVersionId: 1,
    versionUuid: crypto.randomUUID(),
    updatedAt: now,
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
    views: 0,
    firstViewedAt: null,
    pinnedListUuid: null,
    pinnedListOrder: null,
    tabs: [
      {
        uuid: tabUuid,
        name: 'Tab 1',
        order: 0,
      },
    ],
    filters: {
      dimensions: [],
      metrics: [],
      tableCalculations: [],
    },
    inheritsFromOrgOrProject: false,
    access: [],
    colorPaletteUuid: null,
    verification: null,
    config: {
      isDateZoomDisabled: false,
      isAddFilterDisabled: false,
      dateZoomGranularities: ['Day', 'Week', 'Month', 'Quarter', 'Year'],
      defaultDateZoomGranularity: 'Month',
    },
    tiles: [],
  };

  mockDashboardDetails[uuid] = dashboard;
  mockDashboardsList.push({
    uuid,
    name: dashboard.name,
    description: dashboard.description,
    projectUuid: dashboard.projectUuid,
    organizationUuid: dashboard.organizationUuid,
    spaceUuid: dashboard.spaceUuid,
    spaceName: dashboard.spaceName,
    updatedAt: dashboard.updatedAt,
    updatedByUser: dashboard.updatedByUser,
    views: dashboard.views,
    firstViewedAt: dashboard.firstViewedAt,
    pinnedListUuid: dashboard.pinnedListUuid,
    pinnedListOrder: dashboard.pinnedListOrder,
    verification: dashboard.verification,
    tileTypes: [],
  });

  return dashboard;
}

export type UpdateMockDashboardInput = {
  name?: string;
  description?: string;
  tabs?: DashboardTab[];
  tiles?: DashboardTile[];
  filters?: Dashboard['filters'];
  config?: Dashboard['config'];
};

export function updateMockDashboard(
  dashboardUuid: string,
  input: UpdateMockDashboardInput,
): Dashboard | null {
  const existing = mockDashboardDetails[dashboardUuid];
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const name = input.name?.trim() ?? existing.name;
  const updated: Dashboard = {
    ...existing,
    name,
    description:
      input.description !== undefined
        ? input.description.trim() || undefined
        : existing.description,
    slug: input.name ? slugify(name) : existing.slug,
    tabs: input.tabs ?? existing.tabs,
    tiles: input.tiles ?? existing.tiles,
    filters: input.filters ?? existing.filters,
    config: input.config ?? existing.config,
    updatedAt: now,
    dashboardVersionId: existing.dashboardVersionId + 1,
    versionUuid: crypto.randomUUID(),
  };

  mockDashboardDetails[dashboardUuid] = updated;

  const listIndex = mockDashboardsList.findIndex((d) => d.uuid === dashboardUuid);
  if (listIndex >= 0) {
    mockDashboardsList[listIndex] = {
      ...mockDashboardsList[listIndex],
      name: updated.name,
      description: updated.description,
      updatedAt: updated.updatedAt,
      tileTypes: [...new Set(updated.tiles.map((tile) => tile.type))],
    };
  }

  return updated;
}

export const mockDashboardDetails: Record<string, Dashboard> = {
  [MOCK_DASHBOARD_UUID]: {
    uuid: MOCK_DASHBOARD_UUID,
    name: '🧭 KPI dashboard',
    description: 'Key business metrics at a glance',
    slug: 'kpi-dashboard',
    projectUuid: MOCK_PROJECT_UUID,
    organizationUuid: MOCK_ORG_UUID,
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    dashboardVersionId: 1,
    versionUuid: 'f1f1f1f1-a2a2-4b2b-c2c2-d2d2d2d2d2d2',
    updatedAt: '2024-06-01T12:00:00.000Z',
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
    views: 42,
    firstViewedAt: '2024-01-15T08:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    tabs: [
      {
        uuid: MOCK_TAB_UUID,
        name: 'Overview',
        order: 0,
      },
    ],
    filters: {
      dimensions: [
        {
          id: 'city-filter',
          label: 'City',
          operator: 'equals',
          target: {
            fieldId: 'orders_city',
            tableName: 'orders',
          },
          values: [],
          disabled: false,
          required: false,
        },
        {
          id: 'order-date-filter',
          label: 'Order date month',
          operator: 'inThePast',
          settings: {
            completed: true,
            unitOfTime: 'months',
          },
          target: {
            fieldId: 'orders_order_date',
            tableName: 'orders',
          },
          values: [12],
          disabled: false,
          required: false,
        },
        {
          id: 'partner-filter',
          label: 'Partner name',
          operator: 'equals',
          target: {
            fieldId: 'orders_partner_name',
            tableName: 'orders',
          },
          values: [],
          disabled: false,
          required: false,
        },
      ],
      metrics: [],
      tableCalculations: [],
    },
    inheritsFromOrgOrProject: false,
    access: [],
    colorPaletteUuid: null,
    verification: null,
    config: {
      isDateZoomDisabled: false,
      isAddFilterDisabled: false,
      dateZoomGranularities: ['Day', 'Week', 'Month', 'Quarter', 'Year'],
      defaultDateZoomGranularity: 'Month',
    },
    tiles: [
      {
        uuid: '11111111-1111-1111-1111-111111111101',
        type: DashboardTileTypes.HEADING,
        x: 0,
        y: 0,
        w: 36,
        h: 2,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          text: 'Stats at a glance 👀',
          showDivider: false,
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111105',
        type: DashboardTileTypes.MARKDOWN,
        x: 0,
        y: 2,
        w: 36,
        h: 3,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: '',
          content:
            'Read more about our Company KPIs [here](#). Talk to the #data-team if you have any questions about the KPI dashboard or think there is anything missing you would like to add!',
          hideFrame: true,
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111106',
        type: DashboardTileTypes.SAVED_CHART,
        x: 0,
        y: 5,
        w: 12,
        h: 5,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'How many orders have we fulfilled??',
          savedChartUuid: MOCK_CHART_4_UUID,
          chartName: 'How many orders have we fulfilled??',
          lastVersionChartKind: 'big_number',
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111107',
        type: DashboardTileTypes.SAVED_CHART,
        x: 12,
        y: 5,
        w: 12,
        h: 5,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'What is our total revenue this month?',
          savedChartUuid: MOCK_CHART_5_UUID,
          chartName: 'What is our total revenue this month?',
          lastVersionChartKind: 'big_number',
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111108',
        type: DashboardTileTypes.SAVED_CHART,
        x: 24,
        y: 5,
        w: 12,
        h: 5,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'What is our total profit?',
          savedChartUuid: MOCK_CHART_6_UUID,
          chartName: 'What is our total profit?',
          lastVersionChartKind: 'big_number',
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111109',
        type: DashboardTileTypes.HEADING,
        x: 0,
        y: 10,
        w: 36,
        h: 2,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          text: '💸 Sales and Marketing',
          showDivider: false,
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111110',
        type: DashboardTileTypes.MARKDOWN,
        x: 0,
        y: 12,
        w: 36,
        h: 3,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: '',
          content:
            'KPIs around performance of user acquisition, growth of revenue and profit. If you have any questions about any of these metrics, just post to #sales or #marketing in Slack.',
          hideFrame: true,
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111102',
        type: DashboardTileTypes.SAVED_CHART,
        x: 0,
        y: 15,
        w: 18,
        h: 9,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'How much revenue are we making each month?',
          savedChartUuid: MOCK_CHART_UUID,
          chartName: 'Revenue by month',
          lastVersionChartKind: 'line',
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111103',
        type: DashboardTileTypes.SAVED_CHART,
        x: 18,
        y: 15,
        w: 18,
        h: 9,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'How is the average order amount ($) trending each week??',
          savedChartUuid: MOCK_CHART_2_UUID,
          chartName: 'Orders trend',
          lastVersionChartKind: 'line',
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111111',
        type: DashboardTileTypes.SAVED_CHART,
        x: 0,
        y: 24,
        w: 36,
        h: 10,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'What are the sales stats per partner, per month?',
          savedChartUuid: MOCK_CHART_3_UUID,
          chartName: 'Revenue by status',
          lastVersionChartKind: 'pie',
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111112',
        type: DashboardTileTypes.HEADING,
        x: 0,
        y: 34,
        w: 36,
        h: 2,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          text: '☎️ Customer Support',
          showDivider: false,
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111113',
        type: DashboardTileTypes.MARKDOWN,
        x: 0,
        y: 36,
        w: 36,
        h: 3,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: '',
          content:
            'Feedback scores and number of requests for support are tracked here. If you have any questions, ask the #customer-support team in Slack.',
          hideFrame: true,
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111104',
        type: DashboardTileTypes.MARKDOWN,
        x: 0,
        y: 39,
        w: 18,
        h: 8,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'What is our weekly average feedback rating (out of 10)?',
          content: 'Chart placeholder — connect a saved chart to display feedback ratings.',
        },
      },
      {
        uuid: '11111111-1111-1111-1111-111111111114',
        type: DashboardTileTypes.MARKDOWN,
        x: 18,
        y: 39,
        w: 18,
        h: 8,
        tabUuid: MOCK_TAB_UUID,
        properties: {
          title: 'What support request reasons are the most common by percentage?',
          content: 'Chart placeholder — connect a saved chart to display support request breakdown.',
        },
      },
    ],
  },
  [MOCK_DASHBOARD_2_UUID]: {
    uuid: MOCK_DASHBOARD_2_UUID,
    name: 'Marketing Performance',
    description: 'Campaign and channel performance',
    slug: 'marketing-performance',
    projectUuid: MOCK_PROJECT_UUID,
    organizationUuid: MOCK_ORG_UUID,
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    dashboardVersionId: 1,
    versionUuid: 'f2f2f2f2-a3a3-4b3b-c3c3-d3d3d3d3d3d3',
    updatedAt: '2024-05-15T09:00:00.000Z',
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
    views: 12,
    firstViewedAt: '2024-03-01T10:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    tabs: [
      {
        uuid: 'b2b2b2b2-c2c2-4d2d-e2e2-f2f2f2f2f2f2',
        name: 'Campaigns',
        order: 0,
      },
    ],
    filters: {
      dimensions: [],
      metrics: [],
      tableCalculations: [],
    },
    inheritsFromOrgOrProject: false,
    access: [],
    colorPaletteUuid: null,
    verification: null,
    config: {
      isDateZoomDisabled: false,
    },
    tiles: [
      {
        uuid: '22222222-2222-2222-2222-222222222201',
        type: DashboardTileTypes.SAVED_CHART,
        x: 0,
        y: 0,
        w: 36,
        h: 10,
        tabUuid: 'b2b2b2b2-c2c2-4d2d-e2e2-f2f2f2f2f2f2',
        properties: {
          title: 'Channel attribution',
          savedChartUuid: MOCK_CHART_3_UUID,
          chartName: 'Channel attribution',
          lastVersionChartKind: 'horizontal_bar',
        },
      },
    ],
  },
};

export const mockDashboardsList: DashboardBasicDetailsWithTileTypes[] = [
  {
    uuid: MOCK_DASHBOARD_UUID,
    name: '🧭 KPI dashboard',
    description: 'Key business metrics at a glance',
    projectUuid: MOCK_PROJECT_UUID,
    organizationUuid: MOCK_ORG_UUID,
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    updatedAt: '2024-06-01T12:00:00.000Z',
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
    views: 42,
    firstViewedAt: '2024-01-15T08:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    verification: null,
    tileTypes: [
      DashboardTileTypes.HEADING,
      DashboardTileTypes.SAVED_CHART,
      DashboardTileTypes.MARKDOWN,
    ],
  },
  {
    uuid: MOCK_DASHBOARD_2_UUID,
    name: 'Marketing Performance',
    description: 'Campaign and channel performance',
    projectUuid: MOCK_PROJECT_UUID,
    organizationUuid: MOCK_ORG_UUID,
    spaceUuid: MOCK_SPACE_UUID,
    spaceName: 'Shared',
    updatedAt: '2024-05-15T09:00:00.000Z',
    updatedByUser: {
      userUuid: MOCK_USER_UUID,
      firstName: 'Demo',
      lastName: 'Analyst',
    },
    views: 12,
    firstViewedAt: '2024-03-01T10:00:00.000Z',
    pinnedListUuid: null,
    pinnedListOrder: null,
    verification: null,
    tileTypes: [DashboardTileTypes.SAVED_CHART],
  },
];
