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
import { AuthService, ManagedUser } from '../../../core/services/auth.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { SettingsSidebarNavComponent } from '../../../layout/settings-sidebar-nav/settings-sidebar-nav.component';

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
        <mat-form-field appearance="outline">
          <mat-label>Initial password</mat-label>
          <input matInput type="password" formControlName="password" />
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
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: min(100%, 22rem);
      padding-top: 0.5rem;
    }
  `,
})
export class CreateUserDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<CreateUserDialogComponent>);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    role: this.fb.nonNullable.control<'admin' | 'member'>('member'),
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected save(): void {
    if (this.form.invalid) {
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}

@Component({
  selector: 'app-reset-password-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  template: `
    <h2 mat-dialog-title>Reset password</h2>
    <mat-dialog-content>
      <p>Set a new temporary password for {{ data.email }}.</p>
      <form [formGroup]="form">
        <mat-form-field appearance="outline" style="width: 100%">
          <mat-label>New password</mat-label>
          <input matInput type="password" formControlName="password" />
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid">
        Reset
      </button>
    </mat-dialog-actions>
  `,
})
export class ResetPasswordDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<ResetPasswordDialogComponent>);
  protected readonly data = inject<{ email: string }>(MAT_DIALOG_DATA);

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  protected save(): void {
    if (this.form.invalid) {
      return;
    }
    this.dialogRef.close(this.form.getRawValue().password);
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
    ResizableSidebarDirective,
    SettingsSidebarNavComponent,
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
        this.error.set(this.messageFromError(err));
      },
    });
  }

  protected openCreate(): void {
    const ref = this.dialog.open(CreateUserDialogComponent, { width: '28rem' });
    ref.afterClosed().subscribe((value) => {
      if (!value) {
        return;
      }
      this.auth.createUser(value).subscribe({
        next: () => this.reload(),
        error: (err: unknown) => this.error.set(this.messageFromError(err)),
      });
    });
  }

  protected resetPassword(user: ManagedUser): void {
    const ref = this.dialog.open(ResetPasswordDialogComponent, {
      width: '24rem',
      data: { email: user.email },
    });
    ref.afterClosed().subscribe((password: string | undefined) => {
      if (!password) {
        return;
      }
      this.auth.resetUserPassword(user.userUuid, password).subscribe({
        next: () => this.reload(),
        error: (err: unknown) => this.error.set(this.messageFromError(err)),
      });
    });
  }

  protected deactivate(user: ManagedUser): void {
    if (!confirm(`Deactivate ${user.email}?`)) {
      return;
    }
    this.auth.deactivateUser(user.userUuid).subscribe({
      next: () => this.reload(),
      error: (err: unknown) => this.error.set(this.messageFromError(err)),
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
    return 'Request failed';
  }
}
