import { createFeature, createReducer, on } from '@ngrx/store';
import { AuthUiActions } from './auth-ui.actions';

export interface AuthUiState {
  submitting: boolean;
  error: string | null;
  resetCompleted: boolean;
}

const initialState: AuthUiState = {
  submitting: false,
  error: null,
  resetCompleted: false,
};

export const authUiFeature = createFeature({
  name: 'authUi',
  reducer: createReducer(
    initialState,
    on(AuthUiActions.operationStarted, (state) => ({
      ...state,
      submitting: true,
      error: null,
      resetCompleted: false,
    })),
    on(AuthUiActions.operationSucceeded, (state) => ({
      ...state,
      submitting: false,
    })),
    on(AuthUiActions.operationFailed, (state, { message }) => ({
      ...state,
      submitting: false,
      error: message,
    })),
    on(AuthUiActions.clearError, (state) => ({ ...state, error: null })),
    on(AuthUiActions.resetCompleted, (state) => ({
      ...state,
      submitting: false,
      resetCompleted: true,
    })),
    on(AuthUiActions.clearResetCompleted, (state) => ({
      ...state,
      resetCompleted: false,
    })),
  ),
});
