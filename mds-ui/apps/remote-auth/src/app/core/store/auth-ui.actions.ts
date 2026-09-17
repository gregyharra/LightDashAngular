import { createActionGroup, emptyProps, props } from '@ngrx/store';

export const AuthUiActions = createActionGroup({
  source: 'Auth UI',
  events: {
    'Operation Started': emptyProps(),
    'Operation Succeeded': emptyProps(),
    'Operation Failed': props<{ message: string }>(),
    'Clear Error': emptyProps(),
    'Reset Completed': emptyProps(),
    'Clear Reset Completed': emptyProps(),
  },
});
