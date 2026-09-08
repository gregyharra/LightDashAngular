import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AppStateService } from '../../../core/services/app-state.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly appState = inject(AppStateService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(this.ssoErrorFromQuery());
  protected readonly ssoMode = computed(
    () => this.appState.ssoEnabled() || this.appState.authMode() === 'sso',
  );
  protected readonly ssoLoginUrl = this.buildSsoLoginUrl();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected submit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.auth.login(value).subscribe({
      next: (user) => {
        this.submitting.set(false);
        if (user.mustChangePassword) {
          void this.router.navigate(['/reset-password']);
          return;
        }
        const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/projects';
        void this.router.navigateByUrl(redirect);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(this.messageFromError(err));
      },
    });
  }

  private messageFromError(err: unknown): string {
    if (
      typeof err === 'object' &&
      err &&
      'error' in err &&
      typeof (err as { error?: { message?: string } }).error?.message === 'string'
    ) {
      return (err as { error: { message: string } }).error.message;
    }
    return this.translate.instant('auth.errors.invalidCredentials');
  }

  private buildSsoLoginUrl(): string {
    const redirect = this.route.snapshot.queryParamMap.get('redirect');
    if (!redirect) {
      return '/api/auth/login';
    }
    return `/api/auth/login?${new URLSearchParams({ redirect }).toString()}`;
  }

  private ssoErrorFromQuery(): string | null {
    switch (this.route.snapshot.queryParamMap.get('error')) {
      case 'sso_failed':
        return this.translate.instant('auth.errors.ssoFailed');
      case 'not_provisioned':
        return this.translate.instant('auth.errors.notProvisioned');
      default:
        return null;
    }
  }
}
