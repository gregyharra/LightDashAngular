import {
  MOCK_CHART_UUID,
  MOCK_DASHBOARD_2_UUID,
  MOCK_DASHBOARD_UUID,
  MOCK_ORG_UUID,
  MOCK_PROJECT_2_UUID,
  MOCK_PROJECT_UUID,
  MOCK_SPACE_UUID,
  MOCK_USER_UUID,
} from './ids.fixture';
import {
  mockDashboardDetails,
  mockDashboardsList,
} from './dashboards.fixture';
import { mockLineage } from './lineage.fixture';
import { mockDbtProjectTree } from './dbt-project-tree.fixture';
import { mockDbtSources } from './dbt-sources.fixture';
import { mockExplores } from './explores.fixture';
import { mockSavedChartsList } from './charts.fixture';

export { mockExplores };

export const mockHealth = {
  healthy: true,
  mode: 'DEFAULT',
  version: '0.0.0-mock',
  localDbtEnabled: true,
  isAuthenticated: true,
  requiresOrgRegistration: false,
  latest: { version: '0.0.0-mock' },
  rudder: { dataPlaneUrl: '', writeKey: '' },
  sentry: {
    frontend: { dsn: '' },
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    release: '',
    environment: '',
  },
  intercom: { appId: '', apiBase: '' },
  pylon: { appId: '' },
  headway: { enabled: false },
  siteUrl: 'http://localhost:4200',
  staticIp: '',
  query: {
    maxPageSize: 2500,
    maxLimit: 1_000_000,
    queryMaxLimit: 1_000_000,
    defaultLimit: 500,
    csvCellsLimit: 100,
    csvMaxLimit: 5_000_000,
    retryQueryOnTransientErrors: true,
  },
  dashboard: {
    maxTilesPerTab: 50,
    maxTabsPerDashboard: 20,
    disableSentryTracking: false,
  },
  pivotTable: { maxColumnLimit: 100 },
  hasSlack: false,
  auth: {
    disablePasswordAuthentication: false,
    google: { enabled: false, loginPath: '/login/google', oauth2ClientId: '', googleDriveApiKey: '', enableGCloudADC: false },
    okta: { enabled: false, loginPath: '/login/okta' },
    oneLogin: { enabled: false, loginPath: '/login/oneLogin' },
    azuread: { enabled: false, loginPath: '/login/azuread' },
    oidc: { enabled: false, loginPath: '/login/oidc' },
    pat: { maxExpirationTimeInDays: undefined },
    snowflake: { enabled: false },
    databricks: { enabled: false },
  },
  hasEmailClient: false,
  hasEmailWhitelabel: false,
  hasHeadlessBrowser: false,
  hasExtendedUsageAnalytics: false,
  hasGithub: false,
  hasGitlab: false,
  hasCacheAutocompleResults: false,
  hasMicrosoftTeams: false,
  appearance: { overrideColorPalette: undefined, overrideColorPaletteName: undefined },
  isServiceAccountEnabled: false,
  isOrganizationWarehouseCredentialsEnabled: false,
  isAthenaWarehouseIamRoleAuthEnabled: false,
  isSaveCredentialsFormEnabled: false,
  isCustomRolesEnabled: false,
  embedding: { enabled: false, events: undefined },
  ai: { analyticsProjectUuid: undefined, analyticsDashboardUuid: undefined, isAmbientAiEnabled: false },
  echarts6: { enabled: false },
  funnelBuilder: { enabled: false },
  softDelete: { enabled: false, retentionDays: 30 },
  dashboardComments: { enabled: true },
  preAggregates: { enabled: false },
  dataApps: { previewOrigin: null },
};

export const mockUser = {
  userUuid: MOCK_USER_UUID,
  userId: 1,
  email: 'demo@lightdash.com',
  firstName: 'Demo',
  lastName: 'Analyst',
  organizationUuid: MOCK_ORG_UUID,
  organizationName: 'Jaffle Shop',
  organizationCreatedAt: '2024-01-11T03:46:50.732Z',
  isTrackingAnonymized: false,
  isMarketingOptedIn: false,
  isSetupComplete: true,
  role: 'admin',
  isActive: true,
  timezone: 'UTC',
  avatarUrl: null,
  avatarGradient: null,
  abilityRules: [
    { action: 'manage', subject: 'all' },
    { action: 'view', subject: 'Project', conditions: { organizationUuid: MOCK_ORG_UUID } },
    { action: 'manage', subject: 'Project', conditions: { organizationUuid: MOCK_ORG_UUID } },
  ],
  updatedAt: '2024-01-11T03:46:50.732Z',
  createdAt: '2024-01-11T03:46:50.732Z',
  impersonation: null,
};

export const mockAccount = {
  authentication: {
    type: 'password',
    provider: null,
  },
  isRegisteredUser: () => true,
};

export const mockOrganization = {
  organizationUuid: MOCK_ORG_UUID,
  name: 'Jaffle Shop',
  createdAt: '2024-01-11T03:46:50.732Z',
  chartColors: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de'],
  projectCreationInProcess: false,
  needsProject: false,
};

export const mockProjects = [
  {
    projectUuid: MOCK_PROJECT_UUID,
    name: 'Jaffle Shop',
    type: 'DEFAULT',
    createdByUserUuid: MOCK_USER_UUID,
    createdByUserName: 'Demo Analyst',
    createdAt: '2024-01-11T03:46:50.732Z',
    upstreamProjectUuid: null,
    warehouseType: 'trino',
    expiresAt: null,
  },
  {
    projectUuid: MOCK_PROJECT_2_UUID,
    name: 'Marketing Analytics',
    type: 'DEFAULT',
    createdByUserUuid: MOCK_USER_UUID,
    createdByUserName: 'Demo Analyst',
    createdAt: '2024-03-15T10:00:00.000Z',
    upstreamProjectUuid: null,
    warehouseType: 'bigquery',
    expiresAt: null,
  },
];

export const mockOnboardingStatus = {
  ranQuery: true,
};

export const mockSpaces = [
  {
    uuid: MOCK_SPACE_UUID,
    name: 'Shared',
    isPrivate: false,
    projectUuid: MOCK_PROJECT_UUID,
    userAccess: [],
    groupAccess: [],
    parentSpaceUuid: null,
    path: MOCK_SPACE_UUID,
  },
  {
    uuid: 'f6a7b8c9-d0e1-2345-f012-456789012345',
    name: 'Private',
    isPrivate: true,
    projectUuid: MOCK_PROJECT_UUID,
    userAccess: [{ userUuid: MOCK_USER_UUID, hasAccess: true }],
    groupAccess: [],
    parentSpaceUuid: null,
    path: 'f6a7b8c9-d0e1-2345-f012-456789012345',
  },
];

export const mockDashboards = mockDashboardsList;
export { mockDashboardDetails };

export const mockSavedCharts = mockSavedChartsList;

export const mockFavorites = {
  charts: [MOCK_CHART_UUID],
  dashboards: [MOCK_DASHBOARD_UUID],
  spaces: [],
};

export const mockPinnedItems = {
  pinnedListUuid: '11111111-1111-1111-1111-111111111111',
  items: [
    {
      uuid: MOCK_DASHBOARD_UUID,
      type: 'dashboard',
      name: 'Executive Overview',
      spaceUuid: MOCK_SPACE_UUID,
      spaceName: 'Shared',
      order: 0,
    },
  ],
};

export const mockMostPopular = {
  mostPopular: mockSavedCharts,
  recentlyUpdated: mockDashboards,
};

export const mockCatalog = {
  catalog: [],
  pagination: { page: 1, pageSize: 50, totalPageCount: 0, totalResults: 0 },
};

export const mockTablesConfiguration = {
  tableSelection: {
    type: 'WITH_TAGS',
    value: [],
  },
};

export const mockNotifications: unknown[] = [];

export const mockActiveJobs: unknown[] = [];

export const mockFeatureFlag = (flagId: string) => ({
  enabled: flagId !== 'disabled-feature',
  flagId,
});

export { mockLineage, mockDbtSources, mockDbtProjectTree };
