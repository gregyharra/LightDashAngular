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
import { mockSavedChartDetails, createMockSavedChart, updateMockSavedChart, deleteMockSavedChart } from './fixtures/charts.fixture';
import {
  executeMockSqlQuery,
  getMockSqlQueryPollResult,
  getMockSqlQueryResultsStream,
  getMockTableFields,
  isSqlQueryUuid,
  mockWarehouseTablesCatalog,
} from './fixtures/sql-runner.fixture';
import {
  createMockWarehouse,
  deleteMockWarehouse,
  getMockWarehouse,
  listMockWarehouses,
  testMockWarehouse,
  testMockWarehouseConnection,
  updateMockWarehouse,
} from './fixtures/warehouse.fixture';
import { MetricQuery } from '../models/explore.model';
import { ChartConfig, ChartKind } from '../models/chart.model';
import { WarehouseCreate, WarehouseTestConnection, WarehouseUpdate } from '../models/warehouse.model';
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

const savedChartCreate = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/(?:saved|charts)$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  const body = request.body as
    | {
        name?: string;
        description?: string;
        spaceUuid?: string;
        tableName?: string;
        chartKind?: string;
        metricQuery?: MetricQuery;
        chartConfig?: {
          type?: string;
          xField?: string;
          yField?: string;
          yFields?: string[];
          displayConfig?: Record<string, unknown>;
        };
      }
    | null;

  return createMockSavedChart({
    name: body?.name?.trim() || 'Untitled chart',
    description: body?.description?.trim() || undefined,
    projectUuid,
    spaceUuid: body?.spaceUuid,
    tableName: body?.tableName ?? 'orders',
    chartKind: (body?.chartKind ?? body?.chartConfig?.type ?? 'vertical_bar') as
      | 'vertical_bar'
      | 'horizontal_bar'
      | 'line'
      | 'pie'
      | 'table'
      | 'big_number',
    metricQuery: body?.metricQuery ?? {
      exploreName: body?.tableName ?? 'orders',
      dimensions: [],
      metrics: [],
      filters: {},
      sorts: [],
      limit: 500,
      tableCalculations: [],
      additionalMetrics: [],
    },
    chartConfig: {
      type: (body?.chartConfig?.type ?? body?.chartKind ?? 'vertical_bar') as
        | 'vertical_bar'
        | 'horizontal_bar'
        | 'line'
        | 'pie'
        | 'table'
        | 'big_number',
      xField: body?.chartConfig?.xField,
      yField: body?.chartConfig?.yField,
      yFields: body?.chartConfig?.yFields,
      displayConfig: body?.chartConfig?.displayConfig,
    },
  });
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

const savedChartUpdate = (request: MockRequest) => {
  const match = request.path.match(
    /^\/projects\/([^/]+)\/(?:saved|charts)\/([^/]+)$/,
  );
  const chartUuid = match?.[2] ?? MOCK_CHART_UUID;
  const body = (request.body ?? {}) as {
    name?: string;
    description?: string;
    spaceUuid?: string;
    tableName?: string;
    chartKind?: string;
    metricQuery?: MetricQuery;
    chartConfig?: ChartConfig;
  };

  return updateMockSavedChart(chartUuid, {
    name: body.name,
    description: body.description,
    spaceUuid: body.spaceUuid,
    tableName: body.tableName,
    chartKind: body.chartKind as ChartKind | undefined,
    metricQuery: body.metricQuery,
    chartConfig: body.chartConfig,
  });
};

const savedChartDelete = (request: MockRequest) => {
  const match = request.path.match(
    /^\/projects\/[^/]+\/(?:saved|charts)\/([^/]+)$/,
  );
  const chartUuid = match?.[1] ?? MOCK_CHART_UUID;
  deleteMockSavedChart(chartUuid);
  return null;
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

type MockDictionaryOverlay = {
  descriptionOverride?: string | null;
  tags?: string[];
  custom?: Record<string, unknown>;
};

const mockDictionaryModels: Record<string, MockDictionaryOverlay> = {};
const mockDictionaryColumns: Record<string, MockDictionaryOverlay> = {};

function dictionaryColumnKey(uniqueId: string, columnName: string): string {
  return `${uniqueId}::${columnName}`;
}

const dictionaryList = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/dictionary$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  const nodes = (mockLineage.nodes ?? []).map((node) => {
    const overlay = mockDictionaryModels[node.id];
    return {
      id: node.id,
      name: node.name,
      type: node.type,
      description: overlay?.descriptionOverride || node.description || null,
      dbtDescription: node.description || null,
      descriptionOverride: overlay?.descriptionOverride ?? null,
      tags: [...(node.tags ?? []), ...(overlay?.tags ?? [])],
      custom: overlay?.custom ?? {},
      columnCount: node.columnCount ?? node.columns?.length ?? 0,
      hasOverlay: !!overlay,
    };
  });
  return {
    projectUuid,
    projectName: mockLineage.projectName ?? 'Project',
    nodes,
  };
};

const dictionaryQuality = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/dictionary\/quality$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  const nodes = mockLineage.nodes ?? [];
  let modelDescribed = 0;
  let columnTotal = 0;
  let columnDescribed = 0;
  let tagged = 0;
  for (const node of nodes) {
    const overlay = mockDictionaryModels[node.id];
    if (overlay?.descriptionOverride || node.description) {
      modelDescribed += 1;
    }
    if ((node.tags?.length ?? 0) > 0 || (overlay?.tags?.length ?? 0) > 0) {
      tagged += 1;
    }
    for (const column of node.columns ?? []) {
      columnTotal += 1;
      const colOverlay = mockDictionaryColumns[dictionaryColumnKey(node.id, column.name)];
      if (colOverlay?.descriptionOverride || column.description) {
        columnDescribed += 1;
      }
    }
  }
  const modelCoverage = nodes.length ? (modelDescribed / nodes.length) * 100 : 0;
  const columnCoverage = columnTotal ? (columnDescribed / columnTotal) * 100 : 0;
  const tagCoverage = nodes.length ? (tagged / nodes.length) * 100 : 0;
  return {
    projectUuid,
    score: Math.round(
      modelCoverage * 0.3 + columnCoverage * 0.3 + tagCoverage * 0.2 + Math.min(modelCoverage, columnCoverage) * 0.2,
    ),
    models: { total: nodes.length, described: modelDescribed, coverage: Math.round(modelCoverage * 10) / 10 },
    columns: { total: columnTotal, described: columnDescribed, coverage: Math.round(columnCoverage * 10) / 10 },
    tags: { modelsWithTags: tagged, coverage: Math.round(tagCoverage * 10) / 10 },
  };
};

const dictionaryDetail = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/[^/]+\/dictionary\/(.+)$/);
  const uniqueId = decodeURIComponent(match?.[1] ?? '');
  const node =
    (mockLineage.nodes ?? []).find((n) => n.id === uniqueId || n.name === uniqueId) ??
    mockLineage.nodes?.[0];
  if (!node) {
    return null;
  }
  const overlay = mockDictionaryModels[node.id];
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    schema: node.schema,
    database: node.database,
    catalog: node.catalog,
    materialization: node.materialization,
    packageName: node.packageName,
    dbtPath: node.dbtPath,
    sql: node.sql,
    compiledSql: node.compiledSql,
    description: overlay?.descriptionOverride || node.description || null,
    dbtDescription: node.description || null,
    descriptionOverride: overlay?.descriptionOverride ?? null,
    tags: [...(node.tags ?? []), ...(overlay?.tags ?? [])],
    custom: overlay?.custom ?? {},
    hasOverlay: !!overlay,
    columns: (node.columns ?? []).map((column) => {
      const colOverlay = mockDictionaryColumns[dictionaryColumnKey(node.id, column.name)];
      return {
        name: column.name,
        type: column.type,
        description: colOverlay?.descriptionOverride || column.description || null,
        dbtDescription: column.description || null,
        descriptionOverride: colOverlay?.descriptionOverride ?? null,
        tags: [...(column.tags ?? []), ...(colOverlay?.tags ?? [])],
        custom: colOverlay?.custom ?? {},
        hasOverlay: !!colOverlay,
      };
    }),
  };
};

const dictionaryModelUpdate = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/[^/]+\/dictionary\/(.+)$/);
  const uniqueId = decodeURIComponent(match?.[1] ?? '');
  const node =
    (mockLineage.nodes ?? []).find((n) => n.id === uniqueId || n.name === uniqueId) ??
    mockLineage.nodes?.[0];
  if (!node) {
    return null;
  }
  const body = (request.body ?? {}) as MockDictionaryOverlay;
  mockDictionaryModels[node.id] = {
    ...mockDictionaryModels[node.id],
    ...body,
  };
  return dictionaryDetail({
    ...request,
    path: `/projects/${MOCK_PROJECT_UUID}/dictionary/${encodeURIComponent(node.id)}`,
  });
};

const dictionaryColumnUpdate = (request: MockRequest) => {
  const match = request.path.match(
    /^\/projects\/[^/]+\/dictionary\/(.+)\/columns\/([^/]+)$/,
  );
  const uniqueId = decodeURIComponent(match?.[1] ?? '');
  const columnName = decodeURIComponent(match?.[2] ?? '');
  const node =
    (mockLineage.nodes ?? []).find((n) => n.id === uniqueId || n.name === uniqueId) ??
    mockLineage.nodes?.[0];
  if (!node) {
    return null;
  }
  const body = (request.body ?? {}) as MockDictionaryOverlay;
  const key = dictionaryColumnKey(node.id, columnName);
  mockDictionaryColumns[key] = {
    ...mockDictionaryColumns[key],
    ...body,
  };
  return dictionaryDetail({
    ...request,
    path: `/projects/${MOCK_PROJECT_UUID}/dictionary/${encodeURIComponent(node.id)}`,
  });
};

const aiChat = (request: MockRequest) => {
  const body = (request.body ?? {}) as {
    messages?: { role: string; content: string }[];
    mode?: 'ask' | 'edit';
  };
  const userText =
    [...(body.messages ?? [])].reverse().find((message) => message.role === 'user')
      ?.content ?? '';
  const node = (mockLineage.nodes ?? []).find((n) =>
    userText.toLowerCase().includes(n.name.toLowerCase()),
  ) ?? mockLineage.nodes?.[0];
  const mode = body.mode ?? 'ask';
  const proposedChart =
    mode === 'edit' && node
      ? {
          name: `${node.name} chart`,
          tableName: node.name,
          chartKind: 'vertical_bar',
          metricQuery: {
            exploreName: node.name,
            dimensions: [],
            metrics: [`${node.name}_row_count`],
            filters: {},
            sorts: [],
            limit: 500,
            tableCalculations: [],
            additionalMetrics: [],
          },
          chartConfig: {
            type: 'vertical_bar',
            yFields: [`${node.name}_row_count`],
          },
          sql: `select count(*) as row_count from ${node.schema}.${node.name} limit 500`,
        }
      : null;

  return {
    reply: node
      ? `Grounded reply about \`${node.name}\`.\n\nAsk me to describe it, generate SQL, or (in Edit mode) propose a chart.`
      : 'No models available in mock lineage.',
    mode,
    proposedChart,
    toolsUsed: ['buildModelOverview', 'searchModels'],
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

const orgProjectsCreate = (request: MockRequest) => {
  const body = request.body as { name?: string; warehouseUuid?: string | null } | null;
  const name = body?.name?.trim() || 'Untitled project';
  const projectUuid = crypto.randomUUID();
  const warehouseUuid = body?.warehouseUuid ?? null;
  const warehouse = warehouseUuid ? getMockWarehouse(warehouseUuid) : null;
  const now = new Date().toISOString();

  const created = {
    projectUuid,
    name,
    type: 'DEFAULT',
    createdByUserUuid: mockUser.userUuid,
    createdByUserName: `${mockUser.firstName} ${mockUser.lastName}`,
    createdAt: now,
    upstreamProjectUuid: null,
    warehouseType: warehouse?.type ?? 'trino',
    warehouseUuid,
    warehouseName: warehouse?.name ?? null,
    expiresAt: null,
  };

  mockProjects.push(created);

  const spaceUuid = crypto.randomUUID();
  mockSpaces.push({
    uuid: spaceUuid,
    name: 'Shared',
    isPrivate: false,
    projectUuid,
    userAccess: [],
    groupAccess: [],
    parentSpaceUuid: null,
    path: spaceUuid,
  });

  return created;
};

const projectSpacesList = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)\/spaces$/);
  const projectUuid = match?.[1] ?? MOCK_PROJECT_UUID;
  return mockSpaces.filter((space) => space.projectUuid === projectUuid);
};

const projectUpdate = (request: MockRequest) => {
  const match = request.path.match(/^\/projects\/([^/]+)$/);
  const projectUuid = match?.[1];
  if (!projectUuid) {
    return null;
  }

  const body = request.body as { name?: string; warehouseUuid?: string | null } | null;
  const index = mockProjects.findIndex((p) => p.projectUuid === projectUuid);
  const current = index >= 0 ? mockProjects[index] : { ...mockProjects[0], projectUuid };

  const warehouseUuid = body?.warehouseUuid ?? current.warehouseUuid ?? null;
  const warehouse = warehouseUuid ? getMockWarehouse(warehouseUuid) : null;

  const updated = {
    ...current,
    name: body?.name?.trim() || current.name,
    warehouseUuid,
    warehouseName: warehouse?.name ?? null,
  };

  if (index >= 0) {
    mockProjects[index] = updated;
  }

  return updated;
};

const warehousesList = () => listMockWarehouses();

const warehousesCreate = (request: MockRequest) =>
  createMockWarehouse(request.body as WarehouseCreate);

const warehouseDetail = (request: MockRequest) => {
  const match = request.path.match(/^\/warehouses\/([^/]+)$/);
  const warehouseUuid = match?.[1];
  if (!warehouseUuid) {
    return null;
  }
  return getMockWarehouse(warehouseUuid);
};

const warehousePatch = (request: MockRequest) => {
  const match = request.path.match(/^\/warehouses\/([^/]+)$/);
  const warehouseUuid = match?.[1];
  if (!warehouseUuid) {
    return null;
  }
  return updateMockWarehouse(warehouseUuid, request.body as WarehouseUpdate);
};

const warehouseDelete = (request: MockRequest) => {
  const match = request.path.match(/^\/warehouses\/([^/]+)$/);
  const warehouseUuid = match?.[1];
  if (!warehouseUuid) {
    return null;
  }
  deleteMockWarehouse(warehouseUuid);

  for (const project of mockProjects) {
    if (project.warehouseUuid === warehouseUuid) {
      project.warehouseUuid = null;
      project.warehouseName = null;
    }
  }

  return null;
};

const warehouseTest = (request: MockRequest) => {
  const match = request.path.match(/^\/warehouses\/([^/]+)\/test$/);
  const warehouseUuid = match?.[1] ?? '';
  return testMockWarehouse(warehouseUuid);
};

const warehousesTest = (request: MockRequest) =>
  testMockWarehouseConnection((request.body ?? {}) as WarehouseTestConnection);

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
  { pattern: /^\/projects\/[^/]+\/spaces$/, handler: projectSpacesList },
  { pattern: /^\/projects\/[^/]+\/spaces\//, handler: () => mockSpaces[0] },
  { pattern: /^\/projects\/[^/]+\/dashboards$/, method: 'GET', handler: dashboardsList },
  { pattern: /^\/projects\/[^/]+\/dashboards$/, method: 'POST', handler: dashboardCreate },
  { pattern: /^\/projects\/[^/]+\/dashboards\/[^/]+$/, method: 'PATCH', handler: dashboardUpdate },
  { pattern: /^\/projects\/[^/]+\/dashboards\/[^/]+$/, method: 'GET', handler: dashboardDetail },
  { pattern: /^\/projects\/[^/]+\/saved$/, method: 'GET', handler: savedChartsList },
  { pattern: /^\/projects\/[^/]+\/saved$/, method: 'POST', handler: savedChartCreate },
  { pattern: /^\/projects\/[^/]+\/saved\/[^/]+$/, method: 'PATCH', handler: savedChartUpdate },
  { pattern: /^\/projects\/[^/]+\/saved\/[^/]+$/, method: 'DELETE', handler: savedChartDelete },
  { pattern: /^\/projects\/[^/]+\/saved\/[^/]+$/, method: 'GET', handler: savedChartDetail },
  { pattern: /^\/projects\/[^/]+\/charts$/, method: 'GET', handler: savedChartsList },
  { pattern: /^\/projects\/[^/]+\/charts$/, method: 'POST', handler: savedChartCreate },
  { pattern: /^\/projects\/[^/]+\/charts\/[^/]+$/, method: 'PATCH', handler: savedChartUpdate },
  { pattern: /^\/projects\/[^/]+\/charts\/[^/]+$/, method: 'DELETE', handler: savedChartDelete },
  { pattern: /^\/projects\/[^/]+\/charts\/[^/]+$/, method: 'GET', handler: savedChartDetail },
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
  { pattern: /^\/projects\/[^/]+\/dictionary\/quality$/, method: 'GET', handler: dictionaryQuality },
  { pattern: /^\/projects\/[^/]+\/dictionary$/, method: 'GET', handler: dictionaryList },
  { pattern: /^\/projects\/[^/]+\/dictionary\/[^/]+\/columns\/[^/]+$/, method: 'PUT', handler: dictionaryColumnUpdate },
  { pattern: /^\/projects\/[^/]+\/dictionary\/.+$/, method: 'PUT', handler: dictionaryModelUpdate },
  { pattern: /^\/projects\/[^/]+\/dictionary\/.+$/, method: 'GET', handler: dictionaryDetail },
  { pattern: /^\/projects\/[^/]+\/ai\/chat$/, method: 'POST', handler: aiChat },
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
  { pattern: /^\/warehouses$/, method: 'GET', handler: warehousesList },
  { pattern: /^\/warehouses$/, method: 'POST', handler: warehousesCreate },
  { pattern: /^\/warehouses\/test$/, method: 'POST', handler: warehousesTest },
  { pattern: /^\/projects$/, method: 'GET', handler: () => mockProjects },
  { pattern: /^\/projects$/, method: 'POST', handler: orgProjectsCreate },
  { pattern: /^\/warehouses\/[^/]+\/test$/, method: 'POST', handler: warehouseTest },
  { pattern: /^\/warehouses\/[^/]+$/, method: 'GET', handler: warehouseDetail },
  { pattern: /^\/warehouses\/[^/]+$/, method: 'PATCH', handler: warehousePatch },
  { pattern: /^\/warehouses\/[^/]+$/, method: 'DELETE', handler: warehouseDelete },
  { pattern: /^\/projects\/[^/]+\/warehouse-credentials$/, handler: () => [] },
  { pattern: /^\/projects\/[^/]+\/query\/[^/]+$/, method: 'GET', handler: queryPoll },
  { pattern: /^\/projects\/[^/]+$/, method: 'PATCH', handler: projectUpdate },
  { pattern: /^\/projects\/[^/]+$/, method: 'GET', handler: project },

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
