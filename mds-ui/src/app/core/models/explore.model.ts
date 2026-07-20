export type FieldType = 'dimension' | 'metric';

export type DimensionType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'timestamp'
  | 'count';

export type MetricType = 'count' | 'sum' | 'average' | 'min' | 'max' | 'number';

export type FieldId = string;

export type Dimension = {
  fieldType: 'dimension';
  type: DimensionType;
  name: string;
  label: string;
  table: string;
  tableLabel: string;
  sql: string;
  hidden: boolean;
  description?: string;
};

export type Metric = {
  fieldType: 'metric';
  type: MetricType;
  name: string;
  label: string;
  table: string;
  tableLabel: string;
  sql: string;
  hidden: boolean;
  description?: string;
};

export type TemporalTableType = 'none' | 'iceberg' | 'delta';

export type CompiledTable = {
  name: string;
  label: string;
  database: string;
  schema: string;
  sqlTable: string;
  description?: string;
  /** Whether the warehouse table supports point-in-time reads. Defaults to iceberg. */
  temporalType?: TemporalTableType;
  dimensions: Record<string, Dimension>;
  metrics: Record<string, Metric>;
};

export type TimeTravelTableFormat = 'iceberg' | 'delta';

export type TimeTravelConfig = {
  /** ISO-8601 timestamp for point-in-time reads. */
  asOfTimestamp: string;
  /** Override table format for Trino time travel syntax. */
  tableFormat?: TimeTravelTableFormat;
};

export type QueryWarning = {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
};

export type ExploreJoin = {
  table: string;
  sqlOn: string;
  type?: 'left' | 'inner' | 'full' | 'right';
  label?: string;
  relationship?: string;
};

export type ExploreSummary = {
  name: string;
  label: string;
  tags: string[];
  description?: string;
  schemaName: string;
  databaseName: string;
  /** Lineage graph / dbt tree node id when this explore is backed by a dbt model. */
  lineageNodeId?: string;
};

/** Alias matching LightDash `@lightdash/common` naming. */
export type SummaryExplore = ExploreSummary;

export type ExploresMap = Record<string, SummaryExplore>;

export type Explore = {
  name: string;
  label: string;
  tags: string[];
  description?: string;
  baseTable: string;
  joinedTables: ExploreJoin[];
  tables: Record<string, CompiledTable>;
  targetDatabase: string;
};

export type MetricQueryFilter = Record<string, unknown>;

export type MetricQuery = {
  exploreName: string;
  dimensions: FieldId[];
  metrics: FieldId[];
  filters: MetricQueryFilter;
  sorts: { fieldId: FieldId; descending: boolean }[];
  limit: number;
  tableCalculations: unknown[];
  additionalMetrics: unknown[];
  timezone?: string;
  /** When set, queries read table snapshots as of this timestamp. */
  timeTravel?: TimeTravelConfig;
};

export type ResultValue = {
  raw: unknown;
  formatted: string;
};

export type ResultRow = Record<string, { value: ResultValue }>;

export type FieldItem = (Dimension | Metric) & { fieldId: FieldId };

export type QueryResults = {
  queryUuid: string;
  metricQuery: MetricQuery;
  rows: ResultRow[];
  fields: Record<FieldId, FieldItem>;
  cacheMetadata: {
    cacheHit: boolean;
  };
  warnings?: QueryWarning[];
};

export type ExecuteAsyncMetricQueryResponse = {
  queryUuid: string;
  metricQuery: MetricQuery;
  fields: Record<FieldId, FieldItem>;
  cacheMetadata: {
    cacheHit: boolean;
  };
  parameterReferences: string[];
  usedParametersValues: Record<string, unknown>;
  resolvedTimezone: string | null;
  warnings: QueryWarning[];
};

export type AsyncQueryPollResponse =
  | {
      queryUuid: string;
      status: 'ready';
      rows: ResultRow[];
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

export function getFieldId(table: string, fieldName: string): FieldId {
  return `${table}_${fieldName}`;
}
