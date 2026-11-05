import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { AuthService, SetupPayload } from '@mds-ui/core';
import { AuthUiActions } from '../store/auth-ui.actions';
import { authUiFeature } from '../store/auth-ui.reducer';
import { extractApiMessage } from './login-page.facade';

@Injectable()
export class SetupPageFacade {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService, { optional: true });

  readonly submitting = this.store.selectSignal(authUiFeature.selectSubmitting);
  readonly error = this.store.selectSignal(authUiFeature.selectError);

  setup(payload: SetupPayload): void {
    this.store.dispatch(AuthUiActions.operationStarted());
    this.auth.setup(payload).subscribe({
      next: () => {
        this.store.dispatch(AuthUiActions.operationSucceeded());
        void this.router.navigate(['/projects']);
      },
      error: (error: unknown) => {
        this.store.dispatch(
          AuthUiActions.operationFailed({
            message: extractApiMessage(
              error,
              this.translate?.instant('auth.errors.createAdmin') ??
                'Could not create admin',
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
