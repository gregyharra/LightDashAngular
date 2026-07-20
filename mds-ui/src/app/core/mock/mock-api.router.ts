import {
  mockAccount,
  mockActiveJobs,
  mockCatalog,
  mockDashboardDetails,
  mockDashboards,
  mockExplores,
  mockFavorites,
  mockFeatureFlag,
  mockHealth,
  mockMostPopular,
  mockNotifications,
  mockLineage,
  mockDbtSources,
  mockDbtProjectTree,
  mockOnboardingStatus,
  mockOrganization,
  mockPinnedItems,
  mockProjects,
  mockSavedCharts,
  mockSpaces,
  mockTablesConfiguration,
  mockUser,
} from './fixtures/index.fixture';
import { createMockDashboard, updateMockDashboard, UpdateMockDashboardInput } from './fixtures/dashboards.fixture';
import { MOCK_CHART_UUID, MOCK_DASHBOARD_UUID, MOCK_PROJECT_UUID } from './fixtures/ids.fixture';
import { getExploreDetail } from './fixtures/explore-detail.fixture';
import { buildMockQueryResults, getMockQueryPollResult, registerMockQuery } from './fixtures/query-results.fixture';
import { mockSavedChartDetails } from './fixtures/charts.fixture';
import {
  executeMockSqlQuery,
  getMockSqlQueryPollResult,
  getMockSqlQueryResultsStream,
  getMockTableFields,
  isSqlQueryUuid,
  mockWarehouseTablesCatalog,
} from './fixtures/sql-runner.fixture';
import {
  getMockWarehouseConnection,
  testMockWarehouseConnection,
  upsertMockWarehouseConnection,
} from './fixtures/warehouse.fixture';
import { MetricQuery } from '../models/explore.model';
import { WarehouseConnectionUpsert } from '../models/warehouse.model';
import { MockRequest, MockRoute } from './mock-api.types';

const savedChartsList = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/(?:saved|charts)$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return mockSavedCharts.filter((chart) => chart.projectUuid === projectUuid);
};

const savedChartDetailGlobal = (request: MockRequest) => {
  const match = request.path.match(/^\/saved\/([^/]+)$/);
  const chartUuid = match?.[1] ?? MOCK_CHART_UUID;
  return (
    mockSavedChartDetails[chartUuid] ?? {
      ...mockSavedChartDetails[MOCK_CHART_UUID],
      uuid: chartUuid,
    }
  );
};

const savedChartDetail = (request: MockRequest) => {
  const match = request.path.match(
    /^\/projects\/([^/]+)\/(?:saved|charts)\/([^/]+)$/,
  );
  const chartUuid = match?.[2] ?? MOCK_CHART_UUID;
  const found = mockSavedChartDetails[chartUuid];
  return (
    found ?? {
      ...mockSavedChartDetails[MOCK_CHART_UUID],
      uuid: chartUuid,
    }
  );
};

const dashboardsList = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/dashboards$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return mockDashboards.filter((d) => d.projectUuid === projectUuid);
};

const dashboardCreate = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/dashboards$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  const body = request.body as
    | {
        name?: string;
        description?: string;
        spaceUuid?: string;
      }
    | null;

  if (!body?.name?.trim()) {
    return createMockDashboard({
      name: 'Untitled dashboard',
      projectUuid,
      spaceUuid: body?.spaceUuid,
    });
  }

  return createMockDashboard({
    name: body.name.trim(),
    description: body.description?.trim() || undefined,
    projectUuid,
    spaceUuid: body.spaceUuid,
  });
};

const dashboardDetail = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/dashboards\/([^/]+)$/);
  const dashboardUuid = match?.[2] ?? MOCK_DASHBOARD_UUID;
  const found = mockDashboardDetails[dashboardUuid];
  return (
    found ?? {
      ...mockDashboardDetails[MOCK_DASHBOARD_UUID],
      uuid: dashboardUuid,
    }
  );
};

const dashboardUpdate = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/dashboards\/([^/]+)$/);
  const dashboardUuid = match?.[2];
  if (!dashboardUuid) {
    return null;
  }

  const body = request.body as UpdateMockDashboardInput | null;

  return updateMockDashboard(dashboardUuid, body ?? {});
};

const projectLineage = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/lineage$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return {
    ...mockLineage,
    projectUuid,
  };
};

const projectDbtTree = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/dbt-tree$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return {
    ...mockDbtProjectTree,
    projectUuid,
  };
};

const exploresList = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/explores$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  void projectUuid;
  return mockExplores;
};

const exploreDetail = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/explores\/([^/]+)$/);
  const tableId = match?.[2] ?? 'orders';
  return getExploreDetail(tableId);
};

const metricQuery = (request: MockRequest) => {
  const body = request.body as
    | { metricQuery?: MetricQuery; query?: MetricQuery }
    | null;
  const query = body?.query ?? body?.metricQuery ?? {
    exploreName: 'orders',
    dimensions: [],
    metrics: [],
    filters: {},
    sorts: [],
    limit: 500,
    tableCalculations: [],
    additionalMetrics: [],
  };
  const results = buildMockQueryResults(query);
  registerMockQuery(results);

  return {
    queryUuid: results.queryUuid,
    cacheMetadata: results.cacheMetadata,
    parameterReferences: [],
    usedParametersValues: {},
    resolvedTimezone: 'UTC',
    metricQuery: results.metricQuery,
    fields: results.fields,
    warnings: results.warnings ?? [],
  };
};

const queryPoll = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/[^/]+\/query\/([^/]+)$/);
  const queryUuid = match?.[1] ?? '00000000-0000-0000-0000-000000000002';

  if (isSqlQueryUuid(queryUuid)) {
    return getMockSqlQueryPollResult(queryUuid);
  }

  return getMockQueryPollResult(queryUuid);
};

const sqlQuery = (request: MockRequest) => {
  const body = request.body as { sql?: string; limit?: number } | null;
  return executeMockSqlQuery({
    sql: body?.sql ?? '',
    limit: body?.limit,
  });
};

const sqlRunnerTables = () => mockWarehouseTablesCatalog;

const sqlRunnerFields = (request: MockRequest) => {
  const tableName = request.query.get('tableName');
  return getMockTableFields(tableName);
};

const sqlQueryResultsStream = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/[^/]+\/query\/([^/]+)\/results$/);
  const queryUuid = match?.[1] ?? '';
  return getMockSqlQueryResultsStream(queryUuid);
};

const fieldSearch = () => [];

const project = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  const found = mockProjects.find((p) => p.projectUuid === projectUuid);
  return (
    found ?? {
      ...mockProjects[0],
      projectUuid,
      name: 'Mock project',
    }
  );
};

const projectWarehouseGet = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/warehouse$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return getMockWarehouseConnection(projectUuid);
};

const projectWarehouseUpsert = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/warehouse$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return upsertMockWarehouseConnection(projectUuid, request.body as WarehouseConnectionUpsert);
};

const projectWarehouseTest = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/warehouse\/test$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return testMockWarehouseConnection(projectUuid);
};

const routes: MockRoute[] = [
  { pattern: /^\/health$/, handler: () => mockHealth },

  { pattern: /^\/user$/, handler: () => mockUser },
  { pattern: /^\/user\/account$/, handler: () => mockAccount },
  { pattern: /^\/user\/me$/, method: 'GET', handler: () => mockUser },
  { pattern: /^\/user\/me$/, method: 'PATCH', handler: () => mockUser },
  { pattern: /^\/user\/me$/, method: 'DELETE', handler: () => null },
  { pattern: /^\/user\/me\/complete$/, handler: () => mockUser },
  { pattern: /^\/user\/me\/allowedOrganizations$/, handler: () => [] },
  { pattern: /^\/user\/me\/personal-access-tokens/, handler: () => [] },
  { pattern: /^\/user\/password/, handler: () => null },
  { pattern: /^\/user\/identity$/, handler: () => [] },
  { pattern: /^\/user\/warehouseCredentials/, handler: () => [] },
  { pattern: /^\/logout$/, handler: () => null },

  { pattern: /^\/org$/, method: 'GET', handler: () => mockOrganization },
  { pattern: /^\/org$/, method: 'PATCH', handler: () => mockOrganization },
  { pattern: /^\/org\/projects$/, handler: () => mockProjects },
  { pattern: /^\/org\/projects\/precompiled$/, handler: () => [] },
  { pattern: /^\/org\/projects\/[^/]+$/, method: 'DELETE', handler: () => null },
  { pattern: /^\/org\/onboardingStatus$/, handler: () => mockOnboardingStatus },
  { pattern: /^\/org\/users/, handler: () => ({ users: [], pagination: { page: 1, pageSize: 50, totalPageCount: 0, totalResults: 0 } }) },
  { pattern: /^\/org\/groups/, handler: () => [] },
  { pattern: /^\/org\/attributes/, handler: () => [] },
  { pattern: /^\/org\/allowedEmailDomains$/, handler: () => [] },
  { pattern: /^\/org\/brand$/, handler: () => ({}) },
  { pattern: /^\/org\/color-palettes/, handler: () => [] },
  { pattern: /^\/org\/warehouse-credentials/, handler: () => [] },
  { pattern: /^\/org\/impersonation$/, handler: () => [] },
  { pattern: /^\/org\/domains\//, handler: () => ({ verified: true }) },

  { pattern: /^\/projects\/preview-data-timezone$/, handler: () => ({ timezone: 'UTC' }) },
  { pattern: /^\/projects\/[^/]+\/most-popular-and-recently-updated$/, handler: () => mockMostPopular },
  { pattern: /^\/projects\/[^/]+\/hasSavedCharts$/, handler: () => ({ hasSavedCharts: true }) },
  { pattern: /^\/projects\/[^/]+\/hasDefaultUserSpaces$/, handler: () => ({ hasDefaultUserSpaces: true }) },
  { pattern: /^\/projects\/[^/]+\/spaces$/, handler: () => mockSpaces },
  { pattern: /^\/projects\/[^/]+\/spaces\//, handler: () => mockSpaces[0] },
  { pattern: /^\/projects\/[^/]+\/dashboards$/, method: 'GET', handler: dashboardsList },
  { pattern: /^\/projects\/[^/]+\/dashboards$/, method: 'POST', handler: dashboardCreate },
  { pattern: /^\/projects\/[^/]+\/dashboards\/[^/]+$/, method: 'PATCH', handler: dashboardUpdate },
  { pattern: /^\/projects\/[^/]+\/dashboards\/[^/]+$/, method: 'GET', handler: dashboardDetail },
  { pattern: /^\/projects\/[^/]+\/saved$/, handler: savedChartsList },
  { pattern: /^\/projects\/[^/]+\/saved\//, handler: savedChartDetail },
  { pattern: /^\/projects\/[^/]+\/charts$/, handler: savedChartsList },
  { pattern: /^\/projects\/[^/]+\/charts\//, handler: savedChartDetail },
  { pattern: /^\/projects\/[^/]+\/favorites$/, handler: () => mockFavorites },
  { pattern: /^\/projects\/[^/]+\/pinned-lists/, handler: () => mockPinnedItems },
  { pattern: /^\/projects\/[^/]+\/tablesConfiguration$/, handler: () => mockTablesConfiguration },
  { pattern: /^\/projects\/[^/]+\/table-groups$/, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/access$/, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/roles\//, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/user-credentials/, handler: () => null },
  { pattern: /^\/projects\/[^/]+\/user-warehouse-credentials/, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/lineage$/, handler: projectLineage },
  { pattern: /^\/projects\/[^/]+\/dbt-tree$/, handler: projectDbtTree },
  { pattern: /^\/projects\/[^/]+\/explores$/, handler: exploresList },
  { pattern: /^\/projects\/[^/]+\/explores\/[^/]+$/, handler: exploreDetail },
  { pattern: /^\/projects\/[^/]+\/query\/metric-query$/, method: 'POST', handler: metricQuery },
  { pattern: /^\/projects\/[^/]+\/query\/sql$/, method: 'POST', handler: sqlQuery },
  { pattern: /^\/projects\/[^/]+\/query\/[^/]+\/results$/, method: 'GET', handler: sqlQueryResultsStream },
  { pattern: /^\/projects\/[^/]+\/sqlRunner\/tables$/, handler: sqlRunnerTables },
  { pattern: /^\/projects\/[^/]+\/sqlRunner\/fields$/, handler: sqlRunnerFields },
  { pattern: /^\/projects\/[^/]+\/field\/[^/]+\/search$/, handler: fieldSearch },
  { pattern: /^\/projects\/[^/]+\/catalog/, handler: () => mockCatalog },
  { pattern: /^\/projects\/[^/]+\/content-verification$/, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/verified-content-homepage$/, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/validate/, handler: () => ({ validationUuid: '00000000-0000-0000-0000-000000000001', status: 'success', results: [] }) },
  { pattern: /^\/projects\/[^/]+\/refresh$/, handler: () => ({ jobUuid: '00000000-0000-0000-0000-000000000099' }) },
  { pattern: /^\/projects\/[^/]+\/compile-logs/, handler: () => ({ logs: [], pagination: { page: 1, pageSize: 50, totalPageCount: 0, totalResults: 0 } }) },
  { pattern: /^\/projects\/[^/]+\/dbt-sources/, handler: () => mockDbtSources },
  { pattern: /^\/projects\/[^/]+\/previews-config$/, handler: () => ({}) },
  { pattern: /^\/projects\/[^/]+\/colorPalette/, handler: () => ({}) },
  { pattern: /^\/projects\/[^/]+\/queryTimezoneSettings$/, handler: () => ({}) },
  { pattern: /^\/projects\/[^/]+\/schedulerSettings$/, handler: () => ({}) },
  { pattern: /^\/projects\/[^/]+\/warehouse\/test$/, method: 'POST', handler: projectWarehouseTest },
  { pattern: /^\/projects\/[^/]+\/warehouse$/, method: 'GET', handler: projectWarehouseGet },
  { pattern: /^\/projects\/[^/]+\/warehouse$/, method: 'PUT', handler: projectWarehouseUpsert },
  { pattern: /^\/projects\/[^/]+\/warehouse-credentials$/, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/query\/[^/]+$/, method: 'GET', handler: queryPoll },
  { pattern: /^\/projects\/[^/]+$/, handler: project },

  { pattern: /^\/saved\//, handler: savedChartDetailGlobal },
  { pattern: /^\/dashboards\//, handler: dashboardDetail },
  { pattern: /^\/dashboards$/, handler: () => mockDashboards },
  { pattern: /^\/content/, handler: () => ({ data: [], pagination: { page: 1, pageSize: 50, totalPageCount: 0, totalResults: 0 } }) },
  { pattern: /^\/share\//, handler: () => ({ path: `/projects/${MOCK_PROJECT_UUID}/dashboards/${MOCK_DASHBOARD_UUID}` }) },
  { pattern: /^\/share$/, handler: () => ({ nanoid: 'mockshare1' }) },

  { pattern: /^\/feature-flag\//, handler: (request) => mockFeatureFlag(request.path.split('/').pop() ?? 'unknown') },
  { pattern: /^\/notifications$/, handler: () => mockNotifications },
  { pattern: /^\/jobs\//, handler: () => ({ status: 'DONE', details: {} }) },
  { pattern: /^\/jobs$/, handler: () => mockActiveJobs },
  { pattern: /^\/scheduler\//, handler: () => [] },
  { pattern: /^\/schedulers\//, handler: () => [] },
  { pattern: /^\/groups\//, handler: () => ({}) },
  { pattern: /^\/groups$/, handler: () => [] },
  { pattern: /^\/invite-links/, handler: () => [] },
  { pattern: /^\/password-reset/, handler: () => null },
  { pattern: /^\/oauth\/clients/, handler: () => [] },
  { pattern: /^\/impersonation\//, handler: () => null },
  { pattern: /^\/analytics\//, handler: () => ({ rows: [], fields: [] }) },
  { pattern: /^\/gdrive\//, handler: () => ({}) },
  { pattern: /^\/github\//, handler: () => ({}) },
  { pattern: /^\/gitlab\//, handler: () => ({}) },
  { pattern: /^\/slack\//, handler: () => [] },
  { pattern: /^\/snowflake\//, handler: () => ({ isAuthenticated: false }) },
  { pattern: /^\/bigquery\//, handler: () => ({ isAuthenticated: false, projects: [], datasets: [] }) },
  { pattern: /^\/databricks\//, handler: () => ({ isAuthenticated: false }) },
  { pattern: /^\/ai\//, handler: () => ({ result: 'Mock AI response' }) },
  { pattern: /^\/embed\//, handler: () => ({}) },
  { pattern: /^\/orgs\//, handler: () => [] },
];

function fallbackResponse(request: MockRequest): unknown {
  const { method, path } = request;

  if (method === 'DELETE' || method === 'POST' || method === 'PUT' || method === 'PATCH') {
    return null;
  }

  if (path.includes('search') || path.endsWith('s') || path.includes('list')) {
    return [];
  }

  return {};
}

export function resolveMockResponse(request: MockRequest): unknown {
  const match = routes.find(
    (route) =>
      route.pattern.test(request.path) &&
      (!route.method || route.method === request.method),
  );

  if (match) {
    return match.handler(request);
  }

  return fallbackResponse(request);
}

export function parseMockPath(url: string): { path: string; query: URLSearchParams } {
  const normalized = url.replace(/^\/api\/v[12]/, '');
  const [pathPart, queryPart] = normalized.split('?');
  return {
    path: pathPart || '/',
    query: new URLSearchParams(queryPart ?? ''),
  };
}
