import {
  ExecuteAsyncSqlQueryResponse,
  SqlQueryPollResponse,
  SqlRunnerBody,
  SqlRunnerColumn,
  WarehouseTableField,
  WarehouseTableSchema,
  WarehouseTablesCatalog,
} from '../../models/sql-runner.model';

type StoredSqlQuery = {
  columns: SqlRunnerColumn[];
  rows: Record<string, unknown>[];
  error?: string;
};

const pendingSqlQueries = new Map<string, StoredSqlQuery>();
let sqlQueryCounter = 0;

function createSqlQueryUuid(): string {
  sqlQueryCounter += 1;
  return `b4c5d6e7-f8a9-4012-bcde-ef12345678${String(sqlQueryCounter).padStart(2, '0')}`;
}

type OrderRow = {
  order_id: number;
  status: string;
  order_date: string;
  customer_id: number;
  first_name: string;
  last_name: string;
  amount: number;
};

const orderRows: OrderRow[] = [
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

const ordersColumns: SqlRunnerColumn[] = [
  { reference: 'order_id', type: 'number' },
  { reference: 'status', type: 'string' },
  { reference: 'order_date', type: 'date' },
  { reference: 'customer_id', type: 'number' },
  { reference: 'first_name', type: 'string' },
  { reference: 'last_name', type: 'string' },
  { reference: 'amount', type: 'number' },
];

const customersColumns: SqlRunnerColumn[] = [
  { reference: 'customer_id', type: 'number' },
  { reference: 'first_name', type: 'string' },
  { reference: 'last_name', type: 'string' },
];

const customerRows = Array.from(
  new Map(
    orderRows.map((row) => [
      row.customer_id,
      {
        customer_id: row.customer_id,
        first_name: row.first_name,
        last_name: row.last_name,
      },
    ]),
  ).values(),
);

function parseLimit(sql: string, defaultLimit: number): number {
  const match = sql.match(/\blimit\s+(\d+)/i);
  if (match) {
    return Math.min(Number(match[1]), defaultLimit);
  }
  return defaultLimit;
}

function detectTable(sql: string): 'orders' | 'customers' | 'unknown' {
  const normalized = sql.toLowerCase();
  if (/\bfrom\s+orders\b/.test(normalized) || /\bjoin\s+orders\b/.test(normalized)) {
    return 'orders';
  }
  if (/\bfrom\s+customers\b/.test(normalized) || /\bjoin\s+customers\b/.test(normalized)) {
    return 'customers';
  }
  return 'unknown';
}

function validateSql(sql: string): string | null {
  const trimmed = sql.trim();
  if (!trimmed) {
    return 'SQL query cannot be empty.';
  }
  if (!/^\s*select\b/i.test(trimmed)) {
    return 'Only SELECT queries are supported in the SQL runner.';
  }
  if (/\b(syntax\s+error|invalid)\b/i.test(trimmed)) {
    return 'Syntax error near unexpected token.';
  }
  if (/\b(drop|delete|insert|update|truncate|alter|create)\b/i.test(trimmed)) {
    return 'Only read-only SELECT queries are allowed.';
  }
  return null;
}

function buildSqlResults(body: SqlRunnerBody): StoredSqlQuery {
  const validationError = validateSql(body.sql);
  if (validationError) {
    return { columns: [], rows: [], error: validationError };
  }

  const limit = body.limit ?? parseLimit(body.sql, 500);
  const table = detectTable(body.sql);

  if (table === 'orders') {
    return {
      columns: ordersColumns,
      rows: orderRows.slice(0, limit) as Record<string, unknown>[],
    };
  }

  if (table === 'customers') {
    return {
      columns: customersColumns,
      rows: customerRows.slice(0, limit) as Record<string, unknown>[],
    };
  }

  return {
    columns: [{ reference: 'message', type: 'string' }],
    rows: [{ message: 'Query executed successfully (mock empty result).' }],
  };
}

export function executeMockSqlQuery(body: SqlRunnerBody): ExecuteAsyncSqlQueryResponse {
  const queryUuid = createSqlQueryUuid();
  const results = buildSqlResults(body);
  pendingSqlQueries.set(queryUuid, results);

  return {
    queryUuid,
    columns: results.columns,
    cacheMetadata: { cacheHit: false },
    parameterReferences: [],
    usedParametersValues: {},
    resolvedTimezone: 'UTC',
    warnings: [],
  };
}

export function getMockSqlQueryPollResult(queryUuid: string): SqlQueryPollResponse {
  const stored = pendingSqlQueries.get(queryUuid);

  if (!stored) {
    return {
      queryUuid,
      status: 'error',
      error: 'Query not found',
    };
  }

  if (stored.error) {
    return {
      queryUuid,
      status: 'error',
      error: stored.error,
    };
  }

  return {
    queryUuid,
    status: 'ready',
    rows: stored.rows,
    columns: stored.columns,
    totalResults: stored.rows.length,
    page: 1,
    pageSize: stored.rows.length,
    totalPageCount: 1,
    metadata: {
      performance: {
        initialQueryExecutionMs: 62,
        resultsPageExecutionMs: 14,
        queueTimeMs: 8,
      },
    },
    pivotDetails: null,
  };
}

export function isSqlQueryUuid(queryUuid: string): boolean {
  return pendingSqlQueries.has(queryUuid);
}

export const mockWarehouseTablesCatalog: WarehouseTablesCatalog = {
  analytics: {
    jaffle_shop: {
      orders: {},
      customers: {},
      products: {},
      order_items: {},
    },
    staging: {
      stg_orders: {},
      stg_customers: {},
    },
  },
};

const tableFields: Record<string, WarehouseTableField[]> = {
  orders: [
    { name: 'order_id', type: 'number' },
    { name: 'status', type: 'string' },
    { name: 'order_date', type: 'date' },
    { name: 'customer_id', type: 'number' },
    { name: 'amount', type: 'number' },
  ],
  customers: [
    { name: 'customer_id', type: 'number' },
    { name: 'first_name', type: 'string' },
    { name: 'last_name', type: 'string' },
    { name: 'email', type: 'string' },
  ],
  products: [
    { name: 'product_id', type: 'number' },
    { name: 'name', type: 'string' },
    { name: 'price', type: 'number' },
  ],
  order_items: [
    { name: 'order_item_id', type: 'number' },
    { name: 'order_id', type: 'number' },
    { name: 'product_id', type: 'number' },
    { name: 'quantity', type: 'number' },
  ],
  stg_orders: [
    { name: 'order_id', type: 'number' },
    { name: 'status', type: 'string' },
    { name: 'order_date', type: 'date' },
  ],
  stg_customers: [
    { name: 'customer_id', type: 'number' },
    { name: 'first_name', type: 'string' },
    { name: 'last_name', type: 'string' },
  ],
};

export function getMockTableFields(
  tableName: string | null,
): WarehouseTableSchema {
  if (!tableName) {
    return {};
  }

  const fields = tableFields[tableName] ?? [];
  return Object.fromEntries(fields.map((field) => [field.name, field.type]));
}

export function getMockSqlQueryResultsStream(queryUuid: string): string {
  const poll = getMockSqlQueryPollResult(queryUuid);
  if (poll.status !== 'ready') {
    return '';
  }

  return poll.rows.map((row) => JSON.stringify(row)).join('\n');
}

export const defaultSampleSql = `SELECT *
FROM orders
LIMIT 10`;
