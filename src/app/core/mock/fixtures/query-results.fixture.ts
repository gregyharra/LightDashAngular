import {
  FieldId,
  FieldItem,
  MetricQuery,
  QueryResults,
  ResultRow,
  getFieldId,
} from '../../models/explore.model';
import { ordersExplore } from './explore-detail.fixture';
import { fctOrdersExplore } from './explore-fct-orders.fixture';

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
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
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

function buildGroupedRows(
  columnMap: ExploreColumnMapping,
  selectedDimensions: FieldId[],
  selectedMetrics: FieldId[],
): ResultRow[] {
  const groups = new Map<
    string,
    { dimensionValues: Record<FieldId, unknown>; rows: RawOrderRow[] }
  >();

  for (const row of rawOrderRows) {
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
): ResultRow[] {
  if (selectedMetrics.length > 0 && selectedDimensions.length > 0) {
    return buildGroupedRows(columnMap, selectedDimensions, selectedMetrics);
  }

  if (selectedMetrics.length > 0) {
    const totalRevenue = rawOrderRows.reduce((sum, row) => sum + row.amount, 0);
    const orderCount = rawOrderRows.length;
    const avgOrderValue = totalRevenue / orderCount;

    const aggregateRow: ResultRow = {};
    for (const fieldId of selectedDimensions) {
      const key = columnMap[fieldId];
      if (key && key in rawOrderRows[0]) {
        aggregateRow[fieldId] = { value: { raw: null, formatted: '' } };
      }
    }

    for (const metricId of selectedMetrics) {
      if (metricId.endsWith('_total_revenue')) {
        aggregateRow[metricId] = {
          value: { raw: totalRevenue, formatted: formatValue(totalRevenue) },
        };
      } else if (metricId.endsWith('_order_count')) {
        aggregateRow[metricId] = {
          value: { raw: orderCount, formatted: formatValue(orderCount) },
        };
      } else if (metricId.endsWith('_average_order_value')) {
        aggregateRow[metricId] = {
          value: { raw: avgOrderValue, formatted: formatValue(avgOrderValue) },
        };
      }
    }

    return [aggregateRow];
  }

  return rawOrderRows.map((row) => {
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

export function buildMockQueryResults(metricQuery: MetricQuery): QueryResults {
  const selectedDimensions = metricQuery.dimensions;
  const selectedMetrics = metricQuery.metrics;
  const allSelected = [...selectedDimensions, ...selectedMetrics];

  if (metricQuery.exploreName === 'orders') {
    const fields = buildFieldsFromExplore(ordersExplore, allSelected);
    const rows = buildRows(ordersColumnMap, selectedDimensions, selectedMetrics);

    return {
      queryUuid: createQueryUuid(),
      metricQuery,
      rows: rows.slice(0, metricQuery.limit),
      fields,
      cacheMetadata: { cacheHit: true },
    };
  }

  if (metricQuery.exploreName === 'fct_orders') {
    const fields = buildFieldsFromExplore(fctOrdersExplore, allSelected);
    const rows = buildRows(fctOrdersColumnMap, selectedDimensions, selectedMetrics);

    return {
      queryUuid: createQueryUuid(),
      metricQuery,
      rows: rows.slice(0, metricQuery.limit),
      fields,
      cacheMetadata: { cacheHit: true },
    };
  }

  return {
    queryUuid: createQueryUuid(),
    metricQuery,
    rows: [],
    fields: {},
    cacheMetadata: { cacheHit: false },
  };
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
