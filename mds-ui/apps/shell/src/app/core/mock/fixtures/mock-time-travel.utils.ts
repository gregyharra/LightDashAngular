import {
  Explore,
  MetricQuery,
  QueryWarning,
} from '../../models/explore.model';
import {
  buildTimeTravelActiveWarning,
  formatTimeTravelLabel,
  resolveEffectiveTemporalType,
} from '../../../features/explorer/time-travel.utils';

export function exploreSupportsTimeTravel(explore: Explore): boolean {
  const baseTable = explore.tables[explore.baseTable];
  if (!baseTable) {
    return false;
  }

  return resolveEffectiveTemporalType(baseTable.temporalType) !== 'none';
}

export function filterRowsByAsOf<T extends Record<string, unknown>>(
  rows: T[],
  asOfTimestamp: string,
  dateField: keyof T,
): T[] {
  const asOfDate = asOfTimestamp.split('T')[0];
  return rows.filter((row) => {
    const rowDate = String(row[dateField] ?? '');
    return rowDate.localeCompare(asOfDate) <= 0;
  });
}

export function buildMockTimeTravelWarnings(
  metricQuery: MetricQuery,
  explore: Explore | null,
  rowCount: number,
): QueryWarning[] {
  const timeTravel = metricQuery.timeTravel;
  if (!timeTravel?.asOfTimestamp) {
    return [];
  }

  const warnings: QueryWarning[] = [buildTimeTravelActiveWarning(timeTravel)];

  if (explore && !exploreSupportsTimeTravel(explore)) {
    warnings.push({
      code: 'TIME_TRAVEL_UNSUPPORTED',
      message: `Table ${explore.tables[explore.baseTable]?.sqlTable ?? explore.name} does not support time travel. Showing current data.`,
      severity: 'warning',
    });
    return warnings;
  }

  if (rowCount === 0) {
    warnings.push({
      code: 'TIME_TRAVEL_EMPTY',
      message: `No rows found as of ${formatTimeTravelLabel(timeTravel.asOfTimestamp)}.`,
      severity: 'warning',
    });
  }

  return warnings;
}
