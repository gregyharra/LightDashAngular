import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '@mds-ui/core';

@Component({
  selector: 'mds-change-password-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'auth.changePasswordTitle' | translate }}</h2>
    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.currentPassword' | translate }}</mat-label>
          <input matInput type="password" formControlName="currentPassword" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.newPassword' | translate }}</mat-label>
          <input matInput type="password" formControlName="newPassword" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.confirmPassword' | translate }}</mat-label>
          <input matInput type="password" formControlName="confirmPassword" />
        </mat-form-field>
        @if (error) {
          <p class="dialog-error">{{ error }}</p>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>
        {{ 'common.cancel' | translate }}
      </button>
      <button mat-flat-button color="primary" type="button" (click)="save()">
        {{ 'common.save' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: min(100%, 22rem);
      padding-top: 0.5rem;
    }
    .dialog-error {
      color: #b3261e;
      margin: 0;
      font-size: 0.875rem;
    }
  `,
})
export class ChangePasswordDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly dialogRef = inject(
    MatDialogRef<ChangePasswordDialogComponent>,
  );
  private readonly translate = inject(TranslateService);

  protected error: string | null = null;
  protected readonly form = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });

  protected save(): void {
    this.error = null;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    if (value.newPassword !== value.confirmPassword) {
      this.error = this.translate.instant('auth.errors.passwordsDoNotMatch');
      return;
    }
    this.auth
      .changeOwnPassword(value.currentPassword, value.newPassword)
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: (error: unknown) => {
          this.error = this.errorMessage(error);
        },
      });
  }

  private errorMessage(error: unknown): string {
    if (
      typeof error === 'object' &&
      error &&
      'error' in error &&
      typeof (error as { error?: { message?: string } }).error?.message ===
        'string'
    ) {
      return (error as { error: { message: string } }).error.message;
    }
    return this.translate.instant('auth.errors.changePassword');
  }
}
