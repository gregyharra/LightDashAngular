import {
  DashboardDimensionFilter,
  DashboardFilterOperator,
  DashboardFilterSettings,
  DashboardFilterUnitOfTime,
} from '../../../core/models/dashboard.model';
import { DimensionType, Explore, FieldId, TimeTravelConfig, getFieldId } from '../../../core/models/explore.model';
import { getDateAnchor } from '../time-travel.utils';

export type FilterableDimension = {
  fieldId: FieldId;
  label: string;
  type: DimensionType | string;
  tableName: string;
};

const STRING_OPERATORS: DashboardFilterOperator[] = [
  'equals',
  'notEquals',
  'include',
  'doesNotInclude',
  'startsWith',
  'endsWith',
  'isNull',
  'notNull',
];

const NUMBER_OPERATORS: DashboardFilterOperator[] = [
  'equals',
  'notEquals',
  'lessThan',
  'lessThanOrEqual',
  'greaterThan',
  'greaterThanOrEqual',
  'isNull',
  'notNull',
];

const DATE_OPERATORS: DashboardFilterOperator[] = [
  'equals',
  'notEquals',
  'inThePast',
  'notInThePast',
  'inTheNext',
  'lessThan',
  'greaterThan',
  'inBetween',
  'isNull',
  'notNull',
];

export const FILTER_UNIT_OF_TIME_OPTIONS: DashboardFilterUnitOfTime[] = [
  'days',
  'weeks',
  'months',
  'quarters',
  'years',
];

export function getOperatorsForDimensionType(
  type: string,
): DashboardFilterOperator[] {
  switch (type) {
    case 'string':
    case 'boolean':
      return STRING_OPERATORS;
    case 'number':
    case 'count':
      return NUMBER_OPERATORS;
    case 'date':
    case 'timestamp':
      return DATE_OPERATORS;
    default:
      return ['equals', 'notEquals', 'include', 'isNull', 'notNull'];
  }
}

export function defaultOperatorForDimensionType(
  type: string,
): DashboardFilterOperator {
  return getOperatorsForDimensionType(type)[0];
}

export function operatorNeedsValue(operator: DashboardFilterOperator): boolean {
  return operator !== 'isNull' && operator !== 'notNull';
}

export function operatorNeedsUnitOfTime(
  operator: DashboardFilterOperator,
): boolean {
  return (
    operator === 'inThePast' ||
    operator === 'notInThePast' ||
    operator === 'inTheNext'
  );
}

export function operatorNeedsTwoValues(
  operator: DashboardFilterOperator,
): boolean {
  return operator === 'inBetween' || operator === 'notInBetween';
}

export function createExplorerFilter(
  dimension: FilterableDimension,
  operator: DashboardFilterOperator,
  values: unknown[],
  settings?: DashboardFilterSettings,
): DashboardDimensionFilter {
  return {
    id: crypto.randomUUID(),
    label: dimension.label,
    operator,
    target: {
      fieldId: dimension.fieldId,
      tableName: dimension.tableName,
    },
    values,
    settings,
  };
}

export function getFilterableDimensions(explore: Explore): FilterableDimension[] {
  const dimensions: FilterableDimension[] = [];

  for (const table of Object.values(explore.tables)) {
    for (const dim of Object.values(table.dimensions)) {
      if (dim.hidden) {
        continue;
      }

      dimensions.push({
        fieldId: getFieldId(table.name, dim.name),
        label: dim.label,
        type: dim.type,
        tableName: table.name,
      });
    }
  }

  return dimensions.sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

function formatSqlLiteral(value: unknown, type: string): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }

  if (type === 'number' || type === 'count') {
    return String(value);
  }

  return `'${escapeSqlString(String(value))}'`;
}

function resolveFieldExpression(
  explore: Explore,
  fieldId: FieldId,
): { expression: string; type: string } | null {
  for (const table of Object.values(explore.tables)) {
    for (const dim of Object.values(table.dimensions)) {
      if (getFieldId(table.name, dim.name) !== fieldId) {
        continue;
      }

      const expression = dim.sql.replace(/\$\{TABLE\}/g, table.name);
      return { expression, type: dim.type };
    }
  }

  return null;
}

function buildRelativeDateCondition(
  expression: string,
  operator: DashboardFilterOperator,
  count: unknown,
  unit: DashboardFilterUnitOfTime,
  timeTravel?: TimeTravelConfig | null,
): string {
  const amount = Number(count) || 0;
  const interval = `${amount} ${unit}`;
  const anchor = getDateAnchor(timeTravel);

  switch (operator) {
    case 'inThePast':
      return `${expression} >= (${anchor} - INTERVAL '${interval}')`;
    case 'notInThePast':
      return `${expression} < (${anchor} - INTERVAL '${interval}')`;
    case 'inTheNext':
      return `${expression} <= (${anchor} + INTERVAL '${interval}')`;
    default:
      return `${expression} IS NOT NULL`;
  }
}

export function buildFilterSqlCondition(
  explore: Explore,
  filter: DashboardDimensionFilter,
  timeTravel?: TimeTravelConfig | null,
): string | null {
  const resolved = resolveFieldExpression(explore, filter.target.fieldId);
  if (!resolved) {
    return null;
  }

  const { expression, type } = resolved;
  const { operator, values } = filter;

  switch (operator) {
    case 'isNull':
      return `${expression} IS NULL`;
    case 'notNull':
      return `${expression} IS NOT NULL`;
    case 'equals':
      return `${expression} = ${formatSqlLiteral(values[0], type)}`;
    case 'notEquals':
      return `${expression} != ${formatSqlLiteral(values[0], type)}`;
    case 'include':
      return `${expression} LIKE '%${escapeSqlString(String(values[0] ?? ''))}%'`;
    case 'doesNotInclude':
      return `${expression} NOT LIKE '%${escapeSqlString(String(values[0] ?? ''))}%'`;
    case 'startsWith':
      return `${expression} LIKE '${escapeSqlString(String(values[0] ?? ''))}%'`;
    case 'endsWith':
      return `${expression} LIKE '%${escapeSqlString(String(values[0] ?? ''))}'`;
    case 'lessThan':
      return `${expression} < ${formatSqlLiteral(values[0], type)}`;
    case 'lessThanOrEqual':
      return `${expression} <= ${formatSqlLiteral(values[0], type)}`;
    case 'greaterThan':
      return `${expression} > ${formatSqlLiteral(values[0], type)}`;
    case 'greaterThanOrEqual':
      return `${expression} >= ${formatSqlLiteral(values[0], type)}`;
    case 'inBetween':
      return `${expression} BETWEEN ${formatSqlLiteral(values[0], type)} AND ${formatSqlLiteral(values[1], type)}`;
    case 'notInBetween':
      return `${expression} NOT BETWEEN ${formatSqlLiteral(values[0], type)} AND ${formatSqlLiteral(values[1], type)}`;
    case 'inThePast':
    case 'notInThePast':
    case 'inTheNext':
      return buildRelativeDateCondition(
        expression,
        operator,
        values[0],
        filter.settings?.unitOfTime ?? 'months',
        timeTravel,
      );
    default:
      return null;
  }
}

export function buildFiltersWhereClause(
  explore: Explore,
  filters: DashboardDimensionFilter[],
  timeTravel?: TimeTravelConfig | null,
): string | null {
  const conditions = filters
    .filter((filter) => operatorNeedsValue(filter.operator) ? filter.values.length > 0 : true)
    .map((filter) => buildFilterSqlCondition(explore, filter, timeTravel))
    .filter((condition): condition is string => condition !== null);

  if (conditions.length === 0) {
    return null;
  }

  return conditions.join('\n  AND ');
}
