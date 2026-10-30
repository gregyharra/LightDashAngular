import { createFeature, createReducer, on } from '@ngrx/store';
import { ManagedUser } from '@mds-ui/core';
import { UsersActions } from './users.actions';

export interface UsersState {
  users: ManagedUser[];
  loading: boolean;
  error: string | null;
  temporaryPassword: string | null;
}

const initialState: UsersState = {
  users: [],
  loading: false,
  error: null,
  temporaryPassword: null,
};

export const usersFeature = createFeature({
  name: 'authUsers',
  reducer: createReducer(
    initialState,
    on(UsersActions.loadStarted, (state) => ({
      ...state,
      loading: true,
      error: null,
    })),
    on(UsersActions.loadSucceeded, (state, { users }) => ({
      ...state,
      users,
      loading: false,
    })),
    on(UsersActions.requestFailed, (state, { message }) => ({
      ...state,
      loading: false,
      error: message,
    })),
    on(UsersActions.errorCleared, (state) => ({ ...state, error: null })),
    on(
      UsersActions.temporaryPasswordReceived,
      (state, { temporaryPassword }) => ({
        ...state,
        temporaryPassword,
        error: null,
      }),
    ),
    on(UsersActions.temporaryPasswordCleared, (state) => ({
      ...state,
      temporaryPassword: null,
    })),
  ),
});
