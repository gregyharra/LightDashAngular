import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SetupPageFacade } from '../core/facades/setup-page.facade';

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
  private readonly facade = inject(SetupPageFacade);
  private readonly translate = inject(TranslateService);

  protected readonly submitting = this.facade.submitting;
  protected readonly error = this.facade.error;

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  protected submit(): void {
    this.facade.clearError();
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

    this.facade.setup({
      email: value.email,
      firstName: value.firstName,
      lastName: value.lastName,
      password: value.password,
    });
  }
}
