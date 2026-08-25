import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-setup-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './setup-page.component.html',
  styleUrl: './setup-page.component.scss',
})
export class SetupPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  protected submit(): void {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.password !== value.confirmPassword) {
      this.error.set(this.translate.instant('auth.errors.passwordsDoNotMatch'));
      return;
    }

    this.submitting.set(true);
    this.auth
      .setup({
        email: value.email,
        firstName: value.firstName,
        lastName: value.lastName,
        password: value.password,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
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
    return this.translate.instant('auth.errors.createAdmin');
  }
}
