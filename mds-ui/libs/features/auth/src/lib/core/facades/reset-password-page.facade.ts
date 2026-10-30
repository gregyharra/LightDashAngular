import { computed, Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { AppStateService, AuthService } from '@mds-ui/core';
import { AuthUiActions } from '../store/auth-ui.actions';
import { authUiFeature } from '../store/auth-ui.reducer';
import { extractApiMessage } from './login-page.facade';

export type ResetPasswordPayload = {
  newPassword: string;
  token?: string;
};

@Injectable()
export class ResetPasswordPageFacade {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly appState = inject(AppStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService, { optional: true });

  readonly submitting = this.store.selectSignal(authUiFeature.selectSubmitting);
  readonly error = this.store.selectSignal(authUiFeature.selectError);
  readonly completed = this.store.selectSignal(
    authUiFeature.selectResetCompleted,
  );
  readonly token = this.route.snapshot.queryParamMap.get('token');
  readonly canSubmitWithoutToken = computed(
    () => !!this.appState.user()?.mustChangePassword,
  );
  readonly missingCredential = computed(
    () => !this.token && !this.canSubmitWithoutToken(),
  );

  resetPassword(payload: ResetPasswordPayload): void {
    this.store.dispatch(AuthUiActions.operationStarted());
    this.auth.resetPassword(payload).subscribe({
      next: () => {
        this.store.dispatch(AuthUiActions.resetCompleted());
        void this.router.navigate(['/projects']);
      },
      error: (error: unknown) => {
        this.store.dispatch(
          AuthUiActions.operationFailed({
            message: extractApiMessage(
              error,
              this.translate?.instant('auth.errors.setPassword') ??
                'Could not set password',
            ),
          }),
        );
      },
    });
  }

  setError(message: string): void {
    this.store.dispatch(AuthUiActions.operationFailed({ message }));
  }

  clearError(): void {
    this.store.dispatch(AuthUiActions.clearError());
  }
}
