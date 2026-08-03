import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  AuthService,
  CreateUserPayload,
  ManagedUser,
  UpdateUserPayload,
} from '../../../core/services/auth.service';

type UserFormValue = {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'member';
};

@Component({
  selector: 'app-create-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Create user</h2>
    <mat-dialog-content>
      <p class="dialog-note">
        A temporary password will be generated. Share it with the user — they must change it on first
        sign-in.
      </p>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>First name</mat-label>
          <input matInput formControlName="firstName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last name</mat-label>
          <input matInput formControlName="lastName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="member">Member</mat-option>
            <mat-option value="admin">Admin</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid">
        Create
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-note {
      margin: 0 0 0.75rem;
      color: rgba(0, 0, 0, 0.65);
      line-height: 1.4;
      max-width: 22rem;
    }
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: min(100%, 22rem);
      padding-top: 0.25rem;
    }
  `,
})
export class CreateUserDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CreateUserDialogComponent, CreateUserPayload>);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    role: this.fb.nonNullable.control<'admin' | 'member'>('member'),
  });

  protected save(): void {
    if (this.form.invalid) {
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}

@Component({
  selector: 'app-edit-user-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Edit user</h2>
    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>First name</mat-label>
          <input matInput formControlName="firstName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Last name</mat-label>
          <input matInput formControlName="lastName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="member">Member</mat-option>
            <mat-option value="admin">Admin</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid">
        Save
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: min(100%, 22rem);
      padding-top: 0.25rem;
    }
  `,
})
export class EditUserDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<EditUserDialogComponent, UserFormValue>);
  private readonly data = inject<ManagedUser>(MAT_DIALOG_DATA);

  protected readonly form = this.fb.nonNullable.group({
    email: [this.data.email, [Validators.required, Validators.email]],
    firstName: [this.data.firstName, Validators.required],
    lastName: [this.data.lastName, Validators.required],
    role: this.fb.nonNullable.control<'admin' | 'member'>(
      this.data.role === 'admin' ? 'admin' : 'member',
    ),
  });

  protected save(): void {
    if (this.form.invalid) {
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}

@Component({
  selector: 'app-temporary-password-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="temp-note">{{ data.message }}</p>
      <div class="temp-password-row">
        <code class="temp-password">{{ data.temporaryPassword }}</code>
        <button
          mat-stroked-button
          type="button"
          class="temp-copy-btn"
          (click)="copy()"
          [attr.aria-label]="copied() ? 'Copied' : 'Copy password'"
        >
          <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" type="button" mat-dialog-close>Done</button>
    </mat-dialog-actions>
  `,
  styles: `
    .temp-note {
      margin: 0 0 1rem;
      color: rgba(0, 0, 0, 0.65);
      line-height: 1.4;
      max-width: 26rem;
    }
    .temp-password-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      min-width: 0;
    }
    .temp-password {
      flex: 1 1 auto;
      min-width: 0;
      padding: 0.65rem 0.85rem;
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.06);
      font-size: 0.95rem;
      word-break: break-all;
      user-select: all;
    }
    .temp-copy-btn {
      flex-shrink: 0;
      white-space: nowrap;

      mat-icon {
        width: 18px;
        height: 18px;
        font-size: 18px;
        margin-right: 4px;
      }
    }
  `,
})
export class TemporaryPasswordDialogComponent {
  protected readonly data = inject<{
    title: string;
    message: string;
    temporaryPassword: string;
  }>(MAT_DIALOG_DATA);
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.data.temporaryPassword);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }
}

@Component({
  selector: 'app-users-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatDialogModule,
  ],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
})
export class UsersPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly displayedColumns = ['name', 'email', 'role', 'status', 'actions'];

  ngOnInit(): void {
    this.reload();
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.auth.listUsers().subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(apiErrorMessage(err, 'Failed to load users'));
      },
    });
  }

  protected openCreate(): void {
    const ref = this.dialog.open(CreateUserDialogComponent, {
      width: '28rem',
      panelClass: 'user-form-dialog-panel',
    });
    ref.afterClosed().subscribe((value: CreateUserPayload | undefined) => {
      if (!value) {
        return;
      }
      this.auth.createUser(value).subscribe({
        next: (created) => {
          this.reload();
          this.showTemporaryPassword({
            title: 'User created',
            message:
              'Copy this temporary password and send it to the user. They must change it on first sign-in.',
            temporaryPassword: created.temporaryPassword ?? '',
          });
        },
        error: (err: unknown) => this.error.set(apiErrorMessage(err, 'Failed to create user')),
      });
    });
  }

  protected openEdit(user: ManagedUser): void {
    const ref = this.dialog.open(EditUserDialogComponent, {
      width: '28rem',
      panelClass: 'user-form-dialog-panel',
      data: user,
    });
    ref.afterClosed().subscribe((value: UserFormValue | undefined) => {
      if (!value) {
        return;
      }
      const patch: UpdateUserPayload = {
        email: value.email,
        firstName: value.firstName,
        lastName: value.lastName,
        role: value.role,
      };
      this.auth.updateUser(user.userUuid, patch).subscribe({
        next: () => {
          this.error.set(null);
          this.reload();
        },
        error: (err: unknown) => this.error.set(apiErrorMessage(err, 'Failed to update user')),
      });
    });
  }

  protected resetPassword(user: ManagedUser): void {
    if (
      !confirm(
        `Reset password for ${user.email}? A new temporary password will be generated for you to copy.`,
      )
    ) {
      return;
    }
    this.auth.resetUserPassword(user.userUuid).subscribe({
      next: (updated) => {
        this.reload();
        this.showTemporaryPassword({
          title: 'Password reset',
          message:
            'Copy this temporary password and send it to the user. They must change it on next sign-in.',
          temporaryPassword: updated.temporaryPassword ?? '',
        });
      },
      error: (err: unknown) => this.error.set(apiErrorMessage(err, 'Failed to reset password')),
    });
  }

  protected deactivate(user: ManagedUser): void {
    if (!confirm(`Deactivate ${user.email}?`)) {
      return;
    }
    this.auth.deactivateUser(user.userUuid).subscribe({
      next: () => this.reload(),
      error: (err: unknown) => this.error.set(apiErrorMessage(err, 'Failed to deactivate user')),
    });
  }

  private showTemporaryPassword(data: {
    title: string;
    message: string;
    temporaryPassword: string;
  }): void {
    if (!data.temporaryPassword) {
      this.error.set('User saved, but no temporary password was returned.');
      return;
    }
    this.dialog.open(TemporaryPasswordDialogComponent, {
      width: '28rem',
      disableClose: true,
      data,
    });
  }
}
