import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { ManagedUser } from '@mds-ui/core';

export const UsersActions = createActionGroup({
  source: 'Auth Users',
  events: {
    'Load Started': emptyProps(),
    'Load Succeeded': props<{ users: ManagedUser[] }>(),
    'Request Failed': props<{ message: string }>(),
    'Error Cleared': emptyProps(),
    'Temporary Password Received': props<{ temporaryPassword: string }>(),
    'Temporary Password Cleared': emptyProps(),
  },
});
