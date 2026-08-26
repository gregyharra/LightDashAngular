import {
  DashboardDimensionFilter,
  DashboardFilterOperator,
  DashboardFilterSettings,
  DateZoomGranularity,
} from '../../core/models/dashboard.model';
import {
  Explore,
  MetricQuery,
  TimeTravelConfig,
  getFieldId,
} from '../../core/models/explore.model';
import { mergeTimeTravelIntoMetricQuery } from '../explorer/time-travel.utils';

type Translate = (key: string) => string;

const OPERATOR_LABEL_KEYS: Record<DashboardFilterOperator, string> = {
  equals: 'dashboardFilters.operators.equals',
  notEquals: 'dashboardFilters.operators.notEquals',
  isNull: 'dashboardFilters.operators.isNull',
  notNull: 'dashboardFilters.operators.notNull',
  startsWith: 'dashboardFilters.operators.startsWith',
  endsWith: 'dashboardFilters.operators.endsWith',
  include: 'dashboardFilters.operators.include',
  doesNotInclude: 'dashboardFilters.operators.doesNotInclude',
  lessThan: 'dashboardFilters.operators.lessThan',
  lessThanOrEqual: 'dashboardFilters.operators.lessThanOrEqual',
  greaterThan: 'dashboardFilters.operators.greaterThan',
  greaterThanOrEqual: 'dashboardFilters.operators.greaterThanOrEqual',
  inThePast: 'dashboardFilters.operators.inThePast',
  notInThePast: 'dashboardFilters.operators.notInThePast',
  inTheNext: 'dashboardFilters.operators.inTheNext',
  inTheCurrent: 'dashboardFilters.operators.inTheCurrent',
  notInTheCurrent: 'dashboardFilters.operators.notInTheCurrent',
  inBetween: 'dashboardFilters.operators.inBetween',
  notInBetween: 'dashboardFilters.operators.notInBetween',
};

function formatUnitOfTime(
  translate: Translate,
  settings?: DashboardFilterSettings,
): string {
  return translate(`dashboardFilters.units.${settings?.unitOfTime ?? 'days'}`);
}

function formatFilterValues(
  filter: DashboardDimensionFilter,
  translate: Translate,
): string {
  if (filter.operator === 'isNull' || filter.operator === 'notNull') {
    return '';
  }

  if (filter.values.length === 0) {
    return translate('dashboardFilters.anyValue');
  }

  if (
    filter.operator === 'inThePast' ||
    filter.operator === 'notInThePast' ||
    filter.operator === 'inTheNext'
  ) {
    const count = filter.values[0];
    return `${String(count)} ${formatUnitOfTime(translate, filter.settings)}`;
  }

  if (
    filter.operator === 'inTheCurrent' ||
    filter.operator === 'notInTheCurrent'
  ) {
    return formatUnitOfTime(translate, filter.settings);
  }

  return filter.values.map((value) => String(value)).join(', ');
}

export function formatFilterOperator(
  operator: DashboardFilterOperator,
  translate: Translate,
): string {
  return translate(OPERATOR_LABEL_KEYS[operator] ?? operator);
}

export function formatDashboardFilterSummary(
  filter: DashboardDimensionFilter,
  translate: Translate,
): string {
  const operator = formatFilterOperator(filter.operator, translate);
  const values = formatFilterValues(filter, translate);
  return values ? `${filter.label} ${operator} ${values}` : `${filter.label} ${operator}`;
}

export function formatDateZoomLabel(
  granularity: DateZoomGranularity,
  translate?: (key: string) => string,
): string {
  const key = `dashboardFilters.dateZoom.${granularity.toLowerCase()}`;
  return translate ? translate(key) : granularity;
}

export function applyDashboardContextToMetricQuery(
  metricQuery: MetricQuery,
  filters: DashboardDimensionFilter[],
  timeTravel?: TimeTravelConfig | null,
  explore?: Explore,
): MetricQuery {
  return mergeTimeTravelIntoMetricQuery(
    mergeDashboardFiltersIntoMetricQuery(metricQuery, filters, explore),
    timeTravel,
  );
}

export function mergeDashboardFiltersIntoMetricQuery(
  metricQuery: MetricQuery,
  filters: DashboardDimensionFilter[],
  explore?: Explore,
): MetricQuery {
  const availableDimensionIds = explore
    ? new Set(
        Object.values(explore.tables).flatMap((table) =>
          Object.values(table.dimensions).map((dimension) =>
            getFieldId(table.name, dimension.name),
          ),
        ),
      )
    : undefined;
  const activeFilters = filters.filter(
    (filter) =>
      !filter.disabled &&
      (filter.values.length > 0 ||
        filter.operator === 'isNull' ||
        filter.operator === 'notNull') &&
      (!availableDimensionIds || availableDimensionIds.has(filter.target.fieldId)),
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
