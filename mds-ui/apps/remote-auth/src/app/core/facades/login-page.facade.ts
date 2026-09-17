import { Injectable, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { AuthService, LoginPayload } from '@mds-ui/core';
import { AuthUiActions } from '../store/auth-ui.actions';
import { authUiFeature } from '../store/auth-ui.reducer';

@Injectable()
export class LoginPageFacade {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService, { optional: true });

  readonly submitting = this.store.selectSignal(authUiFeature.selectSubmitting);
  readonly error = this.store.selectSignal(authUiFeature.selectError);

  login(payload: LoginPayload): void {
    this.store.dispatch(AuthUiActions.operationStarted());
    this.auth.login(payload).subscribe({
      next: (user) => {
        this.store.dispatch(AuthUiActions.operationSucceeded());
        if (user.mustChangePassword) {
          void this.router.navigate(['/reset-password']);
          return;
        }
        const redirect =
          this.route.snapshot.queryParamMap.get('redirect') || '/projects';
        void this.router.navigateByUrl(redirect);
      },
      error: (error: unknown) => {
        this.store.dispatch(
          AuthUiActions.operationFailed({
            message: extractApiMessage(
              error,
              this.translate?.instant('auth.errors.invalidCredentials') ??
                'Login failed',
            ),
          }),
        );
      },
    });
  }
}

export function extractApiMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error &&
    'error' in error &&
    typeof (error as { error?: { message?: string } }).error?.message ===
      'string'
  ) {
    return (error as { error: { message: string } }).error.message;
  }
  return fallback;
}
