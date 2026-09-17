import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ResetPasswordPageFacade } from '../core/facades/reset-password-page.facade';

@Component({
  selector: 'app-reset-password-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    RouterLink,
    TranslatePipe,
  ],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
})
export class ResetPasswordPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly facade = inject(ResetPasswordPageFacade);
  private readonly translate = inject(TranslateService);

  protected readonly submitting = this.facade.submitting;
  protected readonly error = this.facade.error;
  protected readonly success = this.facade.completed;

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  protected get canSubmitWithoutToken(): boolean {
    return this.facade.canSubmitWithoutToken();
  }

  protected get missingCredential(): boolean {
    return this.facade.missingCredential();
  }

  protected submit(): void {
    this.facade.clearError();
    if (this.missingCredential) {
      this.facade.setError(
        this.translate.instant('auth.errors.invalidResetLink'),
      );
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.facade.setError(
        this.translate.instant('auth.errors.passwordsDoNotMatch'),
      );
      return;
    }

    this.facade.resetPassword({
      newPassword: value.password,
      token: this.facade.token ?? undefined,
    });
  }
}
