import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { DpfButtonComponent } from '../../../shared/ui';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    DpfButtonComponent,
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

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

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
}
