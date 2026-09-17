import { createActionGroup, emptyProps, props } from '@ngrx/store';
import {
  ChartQueryKeyInput,
  ChartQuerySnapshot,
} from './chart-query.models';

export const ChartQueryActions = createActionGroup({
  source: 'Chart Query',
  events: {
    Load: props<{ key: string; input: ChartQueryKeyInput }>(),
    'Load Success': props<{ key: string; snapshot: ChartQuerySnapshot }>(),
    'Load Failure': props<{ key: string; error: string }>(),
    Invalidate: props<{ key: string }>(),
    'Invalidate All': emptyProps(),
  },
});
