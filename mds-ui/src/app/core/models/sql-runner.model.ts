export type SqlRunnerColumn = {
  reference: string;
  type: string;
};

export type ParametersValuesMap = Record<
  string,
  string | number | string[] | number[] | null
>;

export type SqlRunnerBody = {
  sql: string;
  limit?: number;
  parameters?: ParametersValuesMap;
  invalidateCache?: boolean;
};

export type ExecuteAsyncSqlQueryResponse = {
  queryUuid: string;
  columns: SqlRunnerColumn[];
  cacheMetadata: {
    cacheHit: boolean;
  };
  parameterReferences: string[];
  usedParametersValues: Record<string, unknown>;
  resolvedTimezone: string | null;
  warnings: unknown[];
};

export type SqlQueryPollResponse =
  | {
      queryUuid: string;
      status: 'ready';
      rows: Record<string, unknown>[];
      columns: SqlRunnerColumn[];
      totalResults: number;
      page: number;
      pageSize: number;
      totalPageCount: number;
      metadata: {
        performance: {
          initialQueryExecutionMs: number | null;
          resultsPageExecutionMs: number;
          queueTimeMs: number | null;
        };
      };
      pivotDetails: null;
    }
  | {
      queryUuid: string;
      status: 'pending' | 'queued' | 'executing';
    }
  | {
      queryUuid: string;
      status: 'error' | 'expired';
      error: string | null;
    };

export type SqlRunnerResults = {
  queryUuid: string;
  columns: SqlRunnerColumn[];
  rows: Record<string, unknown>[];
  totalResults: number;
};

export type PartitionColumn = {
  partitionType: 'DATE' | 'RANGE';
  field: string;
};

/** Mirrors `@lightdash/common` `WarehouseTablesCatalog`. */
export type WarehouseTablesCatalog = {
  [database: string]: {
    [schema: string]: {
      [table: string]: {
        partitionColumn?: PartitionColumn;
      };
    };
  };
};

/** Mirrors `@lightdash/common` `WarehouseTableSchema`. */
export type WarehouseTableSchema = {
  [column: string]: string;
};

export type WarehouseTableField = {
  name: string;
  type: string;
};

export type WarehouseSchemaEntry = {
  database: string;
  schema: string;
  tables: string[];
};
