import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/services/auth.service';
import { AppStateService } from '../../../core/services/app-state.service';

@Component({
  selector: 'app-reset-password-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
  ],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
})
export class ResetPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly appState = inject(AppStateService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly token = this.route.snapshot.queryParamMap.get('token');

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  protected get canSubmitWithoutToken(): boolean {
    return !!this.appState.user()?.mustChangePassword;
  }

  protected get missingCredential(): boolean {
    return !this.token && !this.canSubmitWithoutToken;
  }

  protected submit(): void {
    this.error.set(null);
    if (this.missingCredential) {
      this.error.set('This reset link is missing or invalid. Ask an admin to issue a new one.');
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    this.submitting.set(true);
    this.auth
      .resetPassword({
        newPassword: value.password,
        token: this.token ?? undefined,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.success.set(true);
          void this.router.navigate(['/projects']);
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
    return 'Could not set a new password';
  }
}
