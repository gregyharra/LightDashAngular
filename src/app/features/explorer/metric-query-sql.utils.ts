import {
  Dimension,
  Explore,
  FieldId,
  Metric,
  getFieldId,
} from '../../core/models/explore.model';

type ResolvedField = {
  tableName: string;
  field: Dimension | Metric;
};

function findField(explore: Explore, fieldId: FieldId): ResolvedField | null {
  for (const table of Object.values(explore.tables)) {
    for (const dim of Object.values(table.dimensions)) {
      if (getFieldId(table.name, dim.name) === fieldId) {
        return { tableName: table.name, field: dim };
      }
    }
    for (const metric of Object.values(table.metrics)) {
      if (getFieldId(table.name, metric.name) === fieldId) {
        return { tableName: table.name, field: metric };
      }
    }
  }
  return null;
}

function resolveTableSql(sql: string, tableName: string): string {
  return sql.replace(/\$\{TABLE\}/g, tableName);
}

function resolveJoinSql(sqlOn: string): string {
  return sqlOn.replace(/\$\{(\w+)\.(\w+)\}/g, '$1.$2');
}

function buildMetricExpression(metric: Metric, tableName: string): string {
  const baseSql = resolveTableSql(metric.sql, tableName);

  switch (metric.type) {
    case 'count':
      return `COUNT(DISTINCT ${baseSql})`;
    case 'sum':
      return `SUM(${baseSql})`;
    case 'average':
      return `AVG(${baseSql})`;
    case 'min':
      return `MIN(${baseSql})`;
    case 'max':
      return `MAX(${baseSql})`;
    default:
      return baseSql;
  }
}

function formatJoinType(type: string | undefined): string {
  switch (type) {
    case 'inner':
      return 'INNER JOIN';
    case 'right':
      return 'RIGHT JOIN';
    case 'full':
      return 'FULL OUTER JOIN';
    default:
      return 'LEFT JOIN';
  }
}

function buildFromClause(
  explore: Explore,
  requiredTables: Set<string>,
): string {
  const baseTable = explore.tables[explore.baseTable];
  if (!baseTable) {
    return '';
  }

  const joined = new Set<string>([explore.baseTable]);
  const lines = [
    `FROM ${baseTable.sqlTable} AS ${baseTable.name}`,
  ];

  for (const join of explore.joinedTables) {
    if (!requiredTables.has(join.table) || joined.has(join.table)) {
      continue;
    }

    const joinedTable = explore.tables[join.table];
    if (!joinedTable) {
      continue;
    }

    lines.push(
      `${formatJoinType(join.type)} ${joinedTable.sqlTable} AS ${joinedTable.name} ON ${resolveJoinSql(join.sqlOn)}`,
    );
    joined.add(join.table);
  }

  return lines.join('\n');
}

export function buildMetricQuerySql(
  explore: Explore,
  dimensions: FieldId[],
  metrics: FieldId[],
  limit = 500,
): string | null {
  if (dimensions.length === 0 && metrics.length === 0) {
    return null;
  }

  const selectParts: string[] = [];
  const groupByParts: string[] = [];
  const requiredTables = new Set<string>();

  for (const fieldId of dimensions) {
    const resolved = findField(explore, fieldId);
    if (!resolved) {
      continue;
    }

    requiredTables.add(resolved.tableName);
    const expression = resolveTableSql(
      resolved.field.sql,
      resolved.tableName,
    );
    selectParts.push(`${expression} AS ${fieldId}`);
    groupByParts.push(expression);
  }

  for (const fieldId of metrics) {
    const resolved = findField(explore, fieldId);
    if (!resolved || resolved.field.fieldType !== 'metric') {
      continue;
    }

    requiredTables.add(resolved.tableName);
    const expression = buildMetricExpression(
      resolved.field,
      resolved.tableName,
    );
    selectParts.push(`${expression} AS ${fieldId}`);
  }

  if (selectParts.length === 0) {
    return null;
  }

  requiredTables.add(explore.baseTable);

  const lines = [
    'SELECT',
    selectParts.map((part) => `  ${part}`).join(',\n'),
    buildFromClause(explore, requiredTables),
  ];

  if (metrics.length > 0 && groupByParts.length > 0) {
    lines.push(`GROUP BY ${groupByParts.join(', ')}`);
  }

  lines.push(`LIMIT ${limit}`);

  return lines.filter((line) => line.length > 0).join('\n');
}
