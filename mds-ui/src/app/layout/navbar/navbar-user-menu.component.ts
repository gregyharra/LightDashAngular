import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslatePipe } from '@ngx-translate/core';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password-dialog',
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
  private readonly dialogRef = inject(MatDialogRef<ChangePasswordDialogComponent>);

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
      this.error = 'Passwords do not match';
      return;
    }
    this.auth.changeOwnPassword(value.currentPassword, value.newPassword).subscribe({
      next: () => this.dialogRef.close(true),
      error: (err: unknown) => {
        if (
          typeof err === 'object' &&
          err &&
          'error' in err &&
          typeof (err as { error?: { message?: string } }).error?.message === 'string'
        ) {
          this.error = (err as { error: { message: string } }).error.message;
        } else {
          this.error = 'Could not change password';
        }
      },
    });
  }
}

@Component({
  selector: 'app-navbar-user-menu',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    TranslatePipe,
  ],
  templateUrl: './navbar-user-menu.component.html',
  styleUrl: './navbar-user-menu.component.scss',
})
export class NavbarUserMenuComponent {
  private readonly appState = inject(AppStateService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.appState.user;
  protected readonly isAdmin = this.appState.isAdmin;

  protected initials(): string {
    const u = this.user();
    if (!u) {
      return '?';
    }
    return `${u.firstName[0] ?? ''}${u.lastName[0] ?? ''}`.trim() || '?';
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login']),
    });
  }
}
