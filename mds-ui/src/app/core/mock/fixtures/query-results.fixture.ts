import {
  Explore,
  FieldId,
  FieldItem,
  MetricQuery,
  QueryResults,
  ResultRow,
  getFieldId,
} from '../../models/explore.model';
import { getExploreDetail, ordersExplore } from './explore-detail.fixture';
import { fctOrdersExplore } from './explore-fct-orders.fixture';
import {
  buildMockTimeTravelWarnings,
  exploreSupportsTimeTravel,
  filterRowsByAsOf,
} from './mock-time-travel.utils';

type RawOrderRow = {
  order_id: number;
  status: string;
  order_date: string;
  customer_id: number;
  first_name: string;
  last_name: string;
  amount: number;
};

const rawOrderRows: RawOrderRow[] = [
  { order_id: 1001, status: 'completed', order_date: '2024-01-05', customer_id: 101, first_name: 'Emma', last_name: 'Johnson', amount: 42.5 },
  { order_id: 1002, status: 'completed', order_date: '2024-01-08', customer_id: 102, first_name: 'Liam', last_name: 'Williams', amount: 78.0 },
  { order_id: 1003, status: 'shipped', order_date: '2024-01-12', customer_id: 103, first_name: 'Olivia', last_name: 'Brown', amount: 35.25 },
  { order_id: 1004, status: 'placed', order_date: '2024-01-15', customer_id: 104, first_name: 'Noah', last_name: 'Jones', amount: 120.0 },
  { order_id: 1005, status: 'completed', order_date: '2024-01-18', customer_id: 105, first_name: 'Ava', last_name: 'Garcia', amount: 56.75 },
  { order_id: 1006, status: 'returned', order_date: '2024-01-22', customer_id: 106, first_name: 'Ethan', last_name: 'Miller', amount: 89.99 },
  { order_id: 1007, status: 'completed', order_date: '2024-02-01', customer_id: 107, first_name: 'Sophia', last_name: 'Davis', amount: 24.5 },
  { order_id: 1008, status: 'shipped', order_date: '2024-02-05', customer_id: 108, first_name: 'Mason', last_name: 'Rodriguez', amount: 67.0 },
  { order_id: 1009, status: 'completed', order_date: '2024-02-10', customer_id: 109, first_name: 'Isabella', last_name: 'Martinez', amount: 145.3 },
  { order_id: 1010, status: 'placed', order_date: '2024-02-14', customer_id: 110, first_name: 'Lucas', last_name: 'Hernandez', amount: 33.8 },
  { order_id: 1011, status: 'completed', order_date: '2024-02-18', customer_id: 111, first_name: 'Mia', last_name: 'Lopez', amount: 92.15 },
  { order_id: 1012, status: 'shipped', order_date: '2024-02-22', customer_id: 112, first_name: 'Jackson', last_name: 'Gonzalez', amount: 51.4 },
  { order_id: 1013, status: 'completed', order_date: '2024-03-01', customer_id: 113, first_name: 'Charlotte', last_name: 'Wilson', amount: 210.0 },
  { order_id: 1014, status: 'completed', order_date: '2024-03-05', customer_id: 114, first_name: 'Aiden', last_name: 'Anderson', amount: 18.99 },
  { order_id: 1015, status: 'returned', order_date: '2024-03-10', customer_id: 115, first_name: 'Amelia', last_name: 'Thomas', amount: 74.6 },
];

const pendingQueries = new Map<string, QueryResults>();

function createQueryUuid(): string {
  return crypto.randomUUID();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && value >= 1000) {
      return value.toLocaleString('en-US');
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function formatDemoKpiValue(metricId: FieldId, raw: number): string {
  if (metricId.endsWith('_order_count')) {
    return '8,616';
  }
  if (metricId.endsWith('_total_revenue')) {
    if (raw > 100000) {
      return `$${raw.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return '124.15K';
  }
  return formatValue(raw);
}

function getDemoKpiRaw(metricId: FieldId): number {
  if (metricId.endsWith('_order_count')) {
    return 8616;
  }
  if (metricId.endsWith('_total_revenue')) {
    return 1097095;
  }
  return 0;
}

function buildFieldItem(table: string, field: FieldItem): FieldItem {
  return {
    ...field,
    fieldId: getFieldId(table, field.name),
  };
}

function buildFieldsFromExplore(
  explore: typeof ordersExplore,
  selectedFieldIds: FieldId[],
): Record<FieldId, FieldItem> {
  const fields: Record<FieldId, FieldItem> = {};

  for (const table of Object.values(explore.tables)) {
    for (const dim of Object.values(table.dimensions)) {
      const fieldId = getFieldId(table.name, dim.name);
      if (selectedFieldIds.includes(fieldId)) {
        fields[fieldId] = buildFieldItem(table.name, { ...dim, fieldId });
      }
    }
    for (const metric of Object.values(table.metrics)) {
      const fieldId = getFieldId(table.name, metric.name);
      if (selectedFieldIds.includes(fieldId)) {
        fields[fieldId] = buildFieldItem(table.name, { ...metric, fieldId });
      }
    }
  }

  return fields;
}

type ExploreColumnMapping = Record<
  string,
  keyof RawOrderRow | 'total_revenue' | 'order_count' | 'average_order_value'
>;

function getDimensionValue(
  row: RawOrderRow,
  fieldId: FieldId,
  columnMap: ExploreColumnMapping,
): unknown {
  const key = columnMap[fieldId];
  if (!key || !(key in row)) {
    return null;
  }

  const raw = row[key as keyof RawOrderRow];
  if (fieldId.endsWith('_order_date') && raw) {
    return String(raw).slice(0, 7);
  }

  return raw;
}

function aggregateMetric(
  metricId: FieldId,
  groupRows: RawOrderRow[],
): number {
  if (metricId.endsWith('_total_revenue')) {
    return groupRows.reduce((sum, row) => sum + row.amount, 0);
  }

  if (metricId.endsWith('_order_count')) {
    return groupRows.length;
  }

  if (metricId.endsWith('_average_order_value')) {
    const total = groupRows.reduce((sum, row) => sum + row.amount, 0);
    return total / groupRows.length;
  }

  return 0;
}

function buildDemoTimeSeriesRows(
  xFieldId: FieldId,
  yFieldId: FieldId,
  months: string[],
  values: number[],
): ResultRow[] {
  return months.map((month, index) => ({
    [xFieldId]: { value: { raw: month, formatted: month } },
    [yFieldId]: {
      value: {
        raw: values[index],
        formatted: formatValue(values[index]),
      },
    },
  }));
}

function tryBuildDemoChartRows(
  metricQuery: MetricQuery,
  fields: Record<FieldId, FieldItem>,
): ResultRow[] | null {
  const xField = metricQuery.dimensions[0];
  const yField = metricQuery.metrics[0];
  if (!xField || !yField || !xField.endsWith('_order_date')) {
    return null;
  }

  if (yField.endsWith('_total_revenue')) {
    return buildDemoTimeSeriesRows(
      xField,
      yField,
      ['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'],
      [124150, 126300, 123900, 128400, 130100, 127800, 129500],
    );
  }

  if (yField.endsWith('_order_count') || yField.endsWith('_average_order_value')) {
    return buildDemoTimeSeriesRows(
      xField,
      yField,
      ['2025-W45', '2025-W46', '2025-W47', '2025-W48', '2025-W49', '2025-W50', '2025-W51'],
      [138, 142, 135, 129, 123, 131, 137],
    );
  }

  void fields;
  return null;
}

function buildGroupedRows(
  columnMap: ExploreColumnMapping,
  selectedDimensions: FieldId[],
  selectedMetrics: FieldId[],
  sourceRows: RawOrderRow[] = rawOrderRows,
): ResultRow[] {
  const groups = new Map<
    string,
    { dimensionValues: Record<FieldId, unknown>; rows: RawOrderRow[] }
  >();

  for (const row of sourceRows) {
    const dimensionValues: Record<FieldId, unknown> = {};
    const keyParts: string[] = [];

    for (const fieldId of selectedDimensions) {
      const value = getDimensionValue(row, fieldId, columnMap);
      dimensionValues[fieldId] = value;
      keyParts.push(String(value));
    }

    const key = keyParts.join('|');
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, { dimensionValues, rows: [row] });
    }
  }

  return Array.from(groups.values())
    .map(({ dimensionValues, rows }) => {
      const resultRow: ResultRow = {};

      for (const fieldId of selectedDimensions) {
        const raw = dimensionValues[fieldId];
        resultRow[fieldId] = {
          value: { raw, formatted: formatValue(raw) },
        };
      }

      for (const metricId of selectedMetrics) {
        const raw = aggregateMetric(metricId, rows);
        resultRow[metricId] = {
          value: { raw, formatted: formatValue(raw) },
        };
      }

      return resultRow;
    })
    .sort((left, right) => {
      const firstDimension = selectedDimensions[0];
      if (!firstDimension) {
        return 0;
      }

      const leftValue = left[firstDimension]?.value.raw;
      const rightValue = right[firstDimension]?.value.raw;
      if (leftValue === rightValue) {
        return 0;
      }
      if (leftValue === null || leftValue === undefined) {
        return 1;
      }
      if (rightValue === null || rightValue === undefined) {
        return -1;
      }
      return String(leftValue).localeCompare(String(rightValue));
    });
}

function buildRows(
  columnMap: ExploreColumnMapping,
  selectedDimensions: FieldId[],
  selectedMetrics: FieldId[],
  sourceRows: RawOrderRow[] = rawOrderRows,
): ResultRow[] {
  if (selectedMetrics.length > 0 && selectedDimensions.length > 0) {
    return buildGroupedRows(columnMap, selectedDimensions, selectedMetrics, sourceRows);
  }

  if (selectedMetrics.length > 0) {
    const totalRevenue = sourceRows.reduce((sum, row) => sum + row.amount, 0);
    const orderCount = sourceRows.length;
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;

    const aggregateRow: ResultRow = {};
    for (const fieldId of selectedDimensions) {
      const key = columnMap[fieldId];
      if (key && sourceRows[0] && key in sourceRows[0]) {
        aggregateRow[fieldId] = { value: { raw: null, formatted: '' } };
      }
    }

    for (const metricId of selectedMetrics) {
      if (metricId.endsWith('_total_revenue')) {
        const raw =
          selectedDimensions.length === 0
            ? getDemoKpiRaw(metricId)
            : totalRevenue;
        aggregateRow[metricId] = {
          value: {
            raw,
            formatted:
              selectedDimensions.length === 0
                ? formatDemoKpiValue(metricId, raw)
                : formatValue(raw),
          },
        };
      } else if (metricId.endsWith('_order_count')) {
        const raw =
          selectedDimensions.length === 0 ? getDemoKpiRaw(metricId) : orderCount;
        aggregateRow[metricId] = {
          value: {
            raw,
            formatted:
              selectedDimensions.length === 0
                ? formatDemoKpiValue(metricId, raw)
                : formatValue(raw),
          },
        };
      } else if (metricId.endsWith('_average_order_value')) {
        aggregateRow[metricId] = {
          value: { raw: avgOrderValue, formatted: formatValue(avgOrderValue) },
        };
      }
    }

    return [aggregateRow];
  }

  return sourceRows.map((row) => {
    const resultRow: ResultRow = {};

    for (const fieldId of selectedDimensions) {
      const key = columnMap[fieldId];
      if (key && key in row) {
        const raw = row[key as keyof RawOrderRow];
        resultRow[fieldId] = {
          value: { raw, formatted: formatValue(raw) },
        };
      }
    }

    return resultRow;
  });
}

const ordersColumnMap: ExploreColumnMapping = {
  orders_order_id: 'order_id',
  orders_status: 'status',
  orders_order_date: 'order_date',
  orders_customer_id: 'customer_id',
  orders_amount: 'amount',
  customers_first_name: 'first_name',
  customers_last_name: 'last_name',
};

const fctOrdersColumnMap: ExploreColumnMapping = {
  fct_orders_order_id: 'order_id',
  fct_orders_status: 'status',
  fct_orders_order_date: 'order_date',
  fct_orders_customer_id: 'customer_id',
  fct_orders_amount: 'amount',
  dim_customers_first_name: 'first_name',
  dim_customers_last_name: 'last_name',
};

const SAMPLE_STRINGS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];
const SAMPLE_STATUSES = ['completed', 'shipped', 'placed', 'returned'];

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function sampleDimensionValue(
  fieldId: FieldId,
  rowIndex: number,
  field: FieldItem,
): unknown {
  const seed = hashString(`${fieldId}:${rowIndex}`);

  switch (field.type) {
    case 'boolean':
      return rowIndex % 2 === 0;
    case 'date':
      return `2024-0${(rowIndex % 9) + 1}-${String((rowIndex % 27) + 1).padStart(2, '0')}`;
    case 'timestamp':
      return `2024-0${(rowIndex % 9) + 1}-${String((rowIndex % 27) + 1).padStart(2, '0')}T12:00:00Z`;
    case 'number':
    case 'count':
      return (seed % 900) + 100;
    default:
      if (field.name.includes('status')) {
        return SAMPLE_STATUSES[rowIndex % SAMPLE_STATUSES.length];
      }
      if (field.name.includes('email')) {
        return `user${rowIndex + 1}@example.com`;
      }
      return `${SAMPLE_STRINGS[rowIndex % SAMPLE_STRINGS.length]} ${rowIndex + 1}`;
  }
}

function buildSyntheticGroupedRows(
  explore: Explore,
  selectedDimensions: FieldId[],
  selectedMetrics: FieldId[],
  fields: Record<FieldId, FieldItem>,
): ResultRow[] {
  const baseRows = Array.from({ length: 8 }, (_, rowIndex) => {
    const dimensionValues: Record<FieldId, unknown> = {};
    for (const fieldId of selectedDimensions) {
      const field = fields[fieldId];
      dimensionValues[fieldId] = field
        ? sampleDimensionValue(fieldId, rowIndex, field)
        : null;
    }
    return dimensionValues;
  });

  const groups = new Map<string, Record<FieldId, unknown>[]>();
  for (const dimensionValues of baseRows) {
    const key = selectedDimensions.map((fieldId) => String(dimensionValues[fieldId])).join('|');
    const existing = groups.get(key) ?? [];
    existing.push(dimensionValues);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).map((groupRows) => {
    const resultRow: ResultRow = {};
    const firstRow = groupRows[0];

    for (const fieldId of selectedDimensions) {
      const raw = firstRow[fieldId];
      resultRow[fieldId] = {
        value: { raw, formatted: formatValue(raw) },
      };
    }

    for (const metricId of selectedMetrics) {
      const metricField = fields[metricId];
      let raw = groupRows.length;

      if (metricField?.type === 'sum') {
        raw = groupRows.reduce((sum, _, index) => sum + ((index + 1) * 17.5), 0);
      } else if (metricField?.type === 'average') {
        raw =
          groupRows.reduce((sum, _, index) => sum + ((index + 1) * 17.5), 0) /
          groupRows.length;
      }

      resultRow[metricId] = {
        value: { raw, formatted: formatValue(raw) },
      };
    }

    return resultRow;
  });
}

function buildSyntheticRows(
  explore: Explore,
  selectedDimensions: FieldId[],
  selectedMetrics: FieldId[],
  fields: Record<FieldId, FieldItem>,
): ResultRow[] {
  if (selectedMetrics.length > 0 && selectedDimensions.length > 0) {
    return buildSyntheticGroupedRows(
      explore,
      selectedDimensions,
      selectedMetrics,
      fields,
    );
  }

  if (selectedMetrics.length > 0) {
    const aggregateRow: ResultRow = {};
    for (const metricId of selectedMetrics) {
      const metricField = fields[metricId];
      const raw =
        metricField?.type === 'sum'
          ? 1240.5
          : metricField?.type === 'average'
            ? 62.03
            : 8;
      aggregateRow[metricId] = {
        value: { raw, formatted: formatValue(raw) },
      };
    }
    return [aggregateRow];
  }

  return Array.from({ length: 8 }, (_, rowIndex) => {
    const resultRow: ResultRow = {};
    for (const fieldId of selectedDimensions) {
      const field = fields[fieldId];
      const raw = field ? sampleDimensionValue(fieldId, rowIndex, field) : null;
      resultRow[fieldId] = {
        value: { raw, formatted: formatValue(raw) },
      };
    }
    return resultRow;
  });
}

function resolveSourceOrderRows(metricQuery: MetricQuery): RawOrderRow[] {
  const timeTravel = metricQuery.timeTravel;
  if (!timeTravel?.asOfTimestamp) {
    return rawOrderRows;
  }

  return filterRowsByAsOf(rawOrderRows, timeTravel.asOfTimestamp, 'order_date');
}

function finalizeMockQueryResults(
  metricQuery: MetricQuery,
  explore: Explore | null,
  rows: ResultRow[],
  fields: Record<FieldId, FieldItem>,
  cacheHit: boolean,
): QueryResults {
  const warnings = buildMockTimeTravelWarnings(metricQuery, explore, rows.length);

  return {
    queryUuid: createQueryUuid(),
    metricQuery,
    rows: rows.slice(0, metricQuery.limit),
    fields,
    cacheMetadata: { cacheHit },
    warnings,
  };
}

function buildGenericMockQueryResults(
  metricQuery: MetricQuery,
  explore: Explore,
): QueryResults {
  const selectedDimensions = metricQuery.dimensions;
  const selectedMetrics = metricQuery.metrics;
  const allSelected = [...selectedDimensions, ...selectedMetrics];
  const fields = buildFieldsFromExplore(explore, allSelected);
  let rows = buildSyntheticRows(
    explore,
    selectedDimensions,
    selectedMetrics,
    fields,
  );

  if (
    metricQuery.timeTravel?.asOfTimestamp &&
    exploreSupportsTimeTravel(explore)
  ) {
    const asOfDate = new Date(metricQuery.timeTravel.asOfTimestamp);
    const day = asOfDate.getUTCDate();
    rows = rows.slice(0, Math.max(0, Math.min(rows.length, day % rows.length || 1)));
  }

  return finalizeMockQueryResults(metricQuery, explore, rows, fields, false);
}

export function buildMockQueryResults(metricQuery: MetricQuery): QueryResults {
  const selectedDimensions = metricQuery.dimensions;
  const selectedMetrics = metricQuery.metrics;
  const allSelected = [...selectedDimensions, ...selectedMetrics];
  const sourceRows = resolveSourceOrderRows(metricQuery);

  if (metricQuery.exploreName === 'orders') {
    const fields = buildFieldsFromExplore(ordersExplore, allSelected);
    const demoRows = tryBuildDemoChartRows(metricQuery, fields);
    const rows =
      demoRows ??
      buildRows(ordersColumnMap, selectedDimensions, selectedMetrics, sourceRows);

    return finalizeMockQueryResults(metricQuery, ordersExplore, rows, fields, true);
  }

  if (metricQuery.exploreName === 'fct_orders') {
    const fields = buildFieldsFromExplore(fctOrdersExplore, allSelected);
    const rows = buildRows(fctOrdersColumnMap, selectedDimensions, selectedMetrics, sourceRows);

    return finalizeMockQueryResults(metricQuery, fctOrdersExplore, rows, fields, true);
  }

  const generatedExplore = getExploreDetail(metricQuery.exploreName);
  if (generatedExplore) {
    return buildGenericMockQueryResults(metricQuery, generatedExplore);
  }

  return finalizeMockQueryResults(metricQuery, null, [], {}, false);
}

export function registerMockQuery(results: QueryResults): void {
  pendingQueries.set(results.queryUuid, results);
}

export function getMockQueryPollResult(queryUuid: string): {
  queryUuid: string;
  status: 'ready' | 'error';
  rows: ResultRow[];
  totalResults: number;
  page: number;
  pageSize: number;
  totalPageCount: number;
  metadata: {
    performance: {
      initialQueryExecutionMs: number;
      resultsPageExecutionMs: number;
      queueTimeMs: number;
    };
  };
  pivotDetails: null;
  error?: string;
} {
  const stored = pendingQueries.get(queryUuid);

  if (!stored) {
    return {
      queryUuid,
      status: 'error',
      rows: [],
      totalResults: 0,
      page: 1,
      pageSize: 0,
      totalPageCount: 0,
      metadata: {
        performance: {
          initialQueryExecutionMs: 0,
          resultsPageExecutionMs: 0,
          queueTimeMs: 0,
        },
      },
      pivotDetails: null,
      error: 'Query not found',
    };
  }

  return {
    queryUuid,
    status: 'ready',
    rows: stored.rows,
    totalResults: stored.rows.length,
    page: 1,
    pageSize: stored.rows.length,
    totalPageCount: 1,
    metadata: {
      performance: {
        initialQueryExecutionMs: 48,
        resultsPageExecutionMs: 12,
        queueTimeMs: 6,
      },
    },
    pivotDetails: null,
  };
}

export const defaultOrdersQueryResults = buildMockQueryResults({
  exploreName: 'orders',
  dimensions: [
    getFieldId('orders', 'order_id'),
    getFieldId('orders', 'status'),
    getFieldId('orders', 'order_date'),
    getFieldId('customers', 'first_name'),
    getFieldId('orders', 'amount'),
  ],
  metrics: [],
  filters: {},
  sorts: [],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
});

registerMockQuery(defaultOrdersQueryResults);
