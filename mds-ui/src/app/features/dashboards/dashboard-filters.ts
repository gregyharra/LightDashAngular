import {
  DashboardDimensionFilter,
  DashboardFilterOperator,
  DashboardFilterSettings,
  DateZoomGranularity,
} from '../../core/models/dashboard.model';
import { MetricQuery, TimeTravelConfig } from '../../core/models/explore.model';
import { mergeTimeTravelIntoMetricQuery } from '../explorer/time-travel.utils';

const OPERATOR_LABELS: Record<DashboardFilterOperator, string> = {
  equals: 'is',
  notEquals: 'is not',
  isNull: 'is null',
  notNull: 'is not null',
  startsWith: 'starts with',
  endsWith: 'ends with',
  include: 'includes',
  doesNotInclude: 'does not include',
  lessThan: 'is less than',
  lessThanOrEqual: 'is less than or equal to',
  greaterThan: 'is greater than',
  greaterThanOrEqual: 'is greater than or equal to',
  inThePast: 'in the last',
  notInThePast: 'not in the last',
  inTheNext: 'in the next',
  inTheCurrent: 'in the current',
  notInTheCurrent: 'not in the current',
  inBetween: 'is between',
  notInBetween: 'is not between',
};

function formatUnitOfTime(settings?: DashboardFilterSettings): string {
  return settings?.unitOfTime ?? 'days';
}

function formatFilterValues(filter: DashboardDimensionFilter): string {
  if (filter.operator === 'isNull' || filter.operator === 'notNull') {
    return '';
  }

  if (filter.values.length === 0) {
    return 'any value';
  }

  if (
    filter.operator === 'inThePast' ||
    filter.operator === 'notInThePast' ||
    filter.operator === 'inTheNext'
  ) {
    const count = filter.values[0];
    return `${String(count)} ${formatUnitOfTime(filter.settings)}`;
  }

  if (
    filter.operator === 'inTheCurrent' ||
    filter.operator === 'notInTheCurrent'
  ) {
    return formatUnitOfTime(filter.settings);
  }

  return filter.values.map((value) => String(value)).join(', ');
}

export function formatFilterOperator(
  operator: DashboardFilterOperator,
): string {
  return OPERATOR_LABELS[operator] ?? operator;
}

export function formatDashboardFilterSummary(
  filter: DashboardDimensionFilter,
): string {
  const operator = formatFilterOperator(filter.operator);
  const values = formatFilterValues(filter);
  return values ? `${filter.label} ${operator} ${values}` : `${filter.label} ${operator}`;
}

export function formatDateZoomLabel(granularity: DateZoomGranularity): string {
  return granularity;
}

export function applyDashboardContextToMetricQuery(
  metricQuery: MetricQuery,
  filters: DashboardDimensionFilter[],
  timeTravel?: TimeTravelConfig | null,
): MetricQuery {
  return mergeTimeTravelIntoMetricQuery(
    mergeDashboardFiltersIntoMetricQuery(metricQuery, filters),
    timeTravel,
  );
}

export function mergeDashboardFiltersIntoMetricQuery(
  metricQuery: MetricQuery,
  filters: DashboardDimensionFilter[],
): MetricQuery {
  const activeFilters = filters.filter(
    (filter) =>
      !filter.disabled &&
      (filter.values.length > 0 ||
        filter.operator === 'isNull' ||
        filter.operator === 'notNull'),
  );

  if (activeFilters.length === 0) {
    return metricQuery;
  }

  const dashboardFilters = activeFilters.map((filter) => ({
    id: filter.id,
    target: filter.target,
    operator: filter.operator,
    values: filter.values,
    settings: filter.settings,
  }));

  return {
    ...metricQuery,
    filters: {
      ...metricQuery.filters,
      dimensions: dashboardFilters,
    },
  };
}
