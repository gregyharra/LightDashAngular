import { DEFAULT_CHART_DISPLAY_CONFIG } from '../../core/models/chart.model';

/** Matches backend / health `query.defaultLimit` when health is unavailable. */
export const DEFAULT_QUERY_LIMIT = DEFAULT_CHART_DISPLAY_CONFIG.rowLimit;

/** Fallback when health `query.maxLimit` is missing (Lightdash RefreshButton uses 5000). */
export const FALLBACK_MAX_QUERY_LIMIT = 5000;

/** Fallback when health `query.csvMaxLimit` is missing. */
export const FALLBACK_CSV_MAX_LIMIT = 5_000_000;

export function resolveMaxQueryLimit(maxLimit: number | null | undefined): number {
  if (typeof maxLimit === 'number' && Number.isFinite(maxLimit) && maxLimit >= 1) {
    return Math.floor(maxLimit);
  }
  return FALLBACK_MAX_QUERY_LIMIT;
}

export function resolveCsvMaxLimit(maxLimit: number | null | undefined): number {
  if (typeof maxLimit === 'number' && Number.isFinite(maxLimit) && maxLimit >= 1) {
    return Math.floor(maxLimit);
  }
  return FALLBACK_CSV_MAX_LIMIT;
}

/** Clamp a raw row-limit input to [1, maxLimit], rounding down. */
export function clampQueryLimit(
  value: number | string | null | undefined,
  maxLimit: number | null | undefined = FALLBACK_MAX_QUERY_LIMIT,
): number {
  const max = resolveMaxQueryLimit(maxLimit);
  const parsed =
    typeof value === 'number' ? value : value == null || value === '' ? NaN : Number(value);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_QUERY_LIMIT;
  }

  return Math.min(max, Math.max(1, Math.floor(parsed)));
}
