import { createSelector } from '@ngrx/store';
import { chartQueryFeature } from './chart-query.reducer';
import { ChartQueryKeyInput } from './chart-query.models';
import { chartQueryKey } from './chart-query.utils';

export const {
  selectChartQueryState,
  selectEntries,
} = chartQueryFeature;

export const selectChartQueryEntry = (key: string) =>
  createSelector(selectEntries, (entries) => entries[key] ?? null);

export const selectChartQuerySnapshot = (key: string) =>
  createSelector(
    selectChartQueryEntry(key),
    (entry) => entry?.snapshot ?? null,
  );

export const selectChartQueryEntryForInput = (
  input: ChartQueryKeyInput | null,
) =>
  createSelector(selectEntries, (entries) => {
    if (!input) {
      return null;
    }
    return entries[chartQueryKey(input)] ?? null;
  });
