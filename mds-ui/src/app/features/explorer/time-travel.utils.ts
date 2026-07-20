import {
  MetricQuery,
  QueryWarning,
  TemporalTableType,
  TimeTravelConfig,
} from '../../core/models/explore.model';

export function mergeTimeTravelIntoMetricQuery(
  metricQuery: MetricQuery,
  timeTravel: TimeTravelConfig | null | undefined,
): MetricQuery {
  if (!timeTravel?.asOfTimestamp) {
    const { timeTravel: _removed, ...rest } = metricQuery;
    return rest;
  }

  return {
    ...metricQuery,
    timeTravel,
  };
}

export function formatTimeTravelLabel(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTrinoTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp.replace('T', ' ').replace('Z', '');
  }

  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  ].join(' ');
}

export function resolveEffectiveTemporalType(
  temporalType: TemporalTableType | undefined,
): TemporalTableType {
  return temporalType ?? 'iceberg';
}

export function resolveSqlTableWithTimeTravel(
  sqlTable: string,
  timeTravel: TimeTravelConfig | null | undefined,
  temporalType: TemporalTableType | undefined,
): { sqlRef: string; warning?: QueryWarning } {
  if (!timeTravel?.asOfTimestamp) {
    return { sqlRef: sqlTable };
  }

  const effectiveType = resolveEffectiveTemporalType(temporalType);
  if (effectiveType === 'none') {
    return {
      sqlRef: sqlTable,
      warning: {
        code: 'TIME_TRAVEL_UNSUPPORTED',
        message: `Table ${sqlTable} does not support time travel. Showing current data.`,
        severity: 'warning',
      },
    };
  }

  const trinoTimestamp = formatTrinoTimestamp(timeTravel.asOfTimestamp);
  return {
    sqlRef: `${sqlTable} FOR TIMESTAMP AS OF TIMESTAMP '${trinoTimestamp}'`,
  };
}

export function getDateAnchor(timeTravel: TimeTravelConfig | null | undefined): string {
  if (!timeTravel?.asOfTimestamp) {
    return 'CURRENT_DATE';
  }

  const datePart = timeTravel.asOfTimestamp.split('T')[0];
  return `DATE '${datePart}'`;
}

export function buildTimeTravelActiveWarning(
  timeTravel: TimeTravelConfig,
): QueryWarning {
  return {
    code: 'TIME_TRAVEL_ACTIVE',
    message: `Viewing data as of ${formatTimeTravelLabel(timeTravel.asOfTimestamp)}. Results may differ from live data.`,
    severity: 'info',
  };
}

export function toDatetimeLocalValue(isoTimestamp: string | undefined): string {
  if (!isoTimestamp) {
    return '';
  }

  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T');
}

export function fromDatetimeLocalValue(value: string): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}
