import { createFeature, createReducer, on } from '@ngrx/store';
import { ChartQueryActions } from './chart-query.actions';
import { initialChartQueryState } from './chart-query.models';

export const chartQueryFeature = createFeature({
  name: 'chartQuery',
  reducer: createReducer(
    initialChartQueryState,
    on(ChartQueryActions.load, (state, { key }) => ({
      ...state,
      entries: {
        ...state.entries,
        [key]: {
          ...state.entries[key],
          status: 'loading' as const,
          error: undefined,
        },
      },
    })),
    on(ChartQueryActions.loadSuccess, (state, { key, snapshot }) => ({
      ...state,
      entries: {
        ...state.entries,
        [key]: {
          status: 'success' as const,
          snapshot,
          error: undefined,
        },
      },
    })),
    on(ChartQueryActions.loadFailure, (state, { key, error }) => ({
      ...state,
      entries: {
        ...state.entries,
        [key]: {
          ...state.entries[key],
          status: 'error' as const,
          error,
        },
      },
    })),
    on(ChartQueryActions.invalidate, (state, { key }) => {
      const { [key]: _removed, ...entries } = state.entries;
      return { ...state, entries };
    }),
    on(ChartQueryActions.invalidateAll, (state) => ({
      ...state,
      entries: {},
    })),
  ),
});
