import { DbtTreeNode, LineageColumn, LineageNode } from '../../core/models/lineage.model';
import {
  CompiledTable,
  Dimension,
  DimensionType,
  Explore,
  Metric,
} from '../../core/models/explore.model';

export function isExploreableDbtTreeNode(node?: DbtTreeNode | null): boolean {
  return (
    node?.type === 'model' ||
    node?.type === 'seed' ||
    node?.type === 'source'
  );
}

export function findLineageNodeById(
  nodes: LineageNode[],
  nodeId: string,
): LineageNode | undefined {
  return nodes.find((node) => node.id === nodeId);
}

export function findLineageNodeByName(
  nodes: LineageNode[],
  name: string,
): LineageNode | undefined {
  return nodes.find((node) => node.name === name);
}

export function resolveLineageNodeForExploreRequest(
  nodes: LineageNode[],
  tableId: string,
): LineageNode | undefined {
  return (
    findLineageNodeById(nodes, tableId) ??
    findLineageNodeByName(nodes, tableId)
  );
}

function formatWords(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatModelLabel(modelName: string): string {
  return formatWords(modelName);
}

export function formatColumnLabel(columnName: string): string {
  return formatWords(columnName);
}

export function mapWarehouseTypeToDimensionType(
  warehouseType: string,
): DimensionType {
  const normalized = warehouseType.toLowerCase();

  if (normalized.includes('bool')) {
    return 'boolean';
  }
  if (normalized === 'date') {
    return 'date';
  }
  if (normalized.includes('timestamp') || normalized.includes('datetime')) {
    return 'timestamp';
  }
  if (
    normalized.includes('int') ||
    normalized.includes('decimal') ||
    normalized.includes('numeric') ||
    normalized.includes('float') ||
    normalized.includes('double') ||
    normalized.includes('real') ||
    normalized === 'number'
  ) {
    return 'number';
  }

  return 'string';
}

function isNumericColumn(column: LineageColumn): boolean {
  return mapWarehouseTypeToDimensionType(column.type) === 'number';
}

function pickCountColumn(columns: LineageColumn[]): LineageColumn {
  const preferred = columns.find((column) =>
    /(^id$|_id$|_count$)/i.test(column.name),
  );
  return preferred ?? columns[0];
}

function pickSumColumn(columns: LineageColumn[]): LineageColumn | undefined {
  return columns.find(
    (column) =>
      isNumericColumn(column) &&
      /amount|revenue|price|cost|total|spend|quantity|count|value/i.test(
        column.name,
      ),
  );
}

function buildDimension(
  column: LineageColumn,
  tableName: string,
  tableLabel: string,
): Dimension {
  return {
    fieldType: 'dimension',
    type: mapWarehouseTypeToDimensionType(column.type),
    name: column.name,
    label: formatColumnLabel(column.name),
    table: tableName,
    tableLabel,
    sql: `\${TABLE}.${column.name}`,
    hidden: false,
    description: column.description,
  };
}

function buildCountMetric(
  column: LineageColumn,
  tableName: string,
  tableLabel: string,
): Metric {
  return {
    fieldType: 'metric',
    type: 'count',
    name: 'row_count',
    label: 'Row count',
    table: tableName,
    tableLabel,
    sql: `\${TABLE}.${column.name}`,
    hidden: false,
    description: `Count of rows in ${tableLabel}`,
  };
}

function buildSumMetric(
  column: LineageColumn,
  tableName: string,
  tableLabel: string,
): Metric {
  const metricName = `total_${column.name}`;
  return {
    fieldType: 'metric',
    type: 'sum',
    name: metricName,
    label: `Total ${formatColumnLabel(column.name)}`,
    table: tableName,
    tableLabel,
    sql: `\${TABLE}.${column.name}`,
    hidden: false,
    description: `Sum of ${formatColumnLabel(column.name)}`,
  };
}

export function buildExploreFromLineageNode(node: LineageNode): Explore {
  const tableName = node.name;
  const tableLabel = formatModelLabel(node.name);
  const columns = node.columns ?? [];

  const dimensions = Object.fromEntries(
    columns.map((column) => [
      column.name,
      buildDimension(column, tableName, tableLabel),
    ]),
  );

  const metrics: Record<string, Metric> = {};
  if (columns.length > 0) {
    metrics['row_count'] = buildCountMetric(
      pickCountColumn(columns),
      tableName,
      tableLabel,
    );

    const sumColumn = pickSumColumn(columns);
    if (sumColumn) {
      const sumMetric = buildSumMetric(sumColumn, tableName, tableLabel);
      metrics[sumMetric.name] = sumMetric;
    }
  }

  const compiledTable: CompiledTable = {
    name: tableName,
    label: tableLabel,
    database: node.database,
    schema: node.schema,
    sqlTable: `${node.schema}.${tableName}`,
    description: node.description,
    dimensions,
    metrics,
  };

  return {
    name: tableName,
    label: tableLabel,
    tags: node.tags ?? [],
    description: node.description,
    baseTable: tableName,
    targetDatabase: 'trino',
    joinedTables: [],
    tables: {
      [tableName]: compiledTable,
    },
  };
}

export function resolveExploreNameForSelection(
  exploreSummaryName: string | undefined,
  treeNode: DbtTreeNode | null,
  lineageNodeId?: string | null,
): string | null {
  if (exploreSummaryName) {
    return exploreSummaryName;
  }

  if (isExploreableDbtTreeNode(treeNode) && treeNode?.name) {
    return treeNode.name;
  }

  if (lineageNodeId) {
    return lineageNodeId;
  }

  return null;
}

export function exploreHasFields(explore: Explore | null | undefined): boolean {
  if (!explore) {
    return false;
  }

  return Object.values(explore.tables).some(
    (table) =>
      Object.keys(table.dimensions).length > 0 ||
      Object.keys(table.metrics).length > 0,
  );
}
