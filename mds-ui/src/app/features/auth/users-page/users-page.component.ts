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
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  AuthService,
  CreateUserPayload,
  ManagedUser,
  UpdateUserPayload,
} from '../../../core/services/auth.service';
import {
  LdButtonComponent,
  LdEmptyStateComponent,
  LdPageFrameComponent,
  LdPageHeaderComponent,
} from '../../../design-system';

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
    TranslatePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'users.create.title' | translate }}</h2>
    <mat-dialog-content>
      <p class="dialog-note">
        {{ 'users.create.note' | translate }}
      </p>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.email' | translate }}</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.firstName' | translate }}</mat-label>
          <input matInput formControlName="firstName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.lastName' | translate }}</mat-label>
          <input matInput formControlName="lastName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.role' | translate }}</mat-label>
          <mat-select formControlName="role">
            <mat-option value="member">{{ 'users.roles.member' | translate }}</mat-option>
            <mat-option value="admin">{{ 'users.roles.admin' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid">
        {{ 'users.create.submit' | translate }}
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
    TranslatePipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'users.edit.title' | translate }}</h2>
    <mat-dialog-content>
      <form class="dialog-form" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.email' | translate }}</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.firstName' | translate }}</mat-label>
          <input matInput formControlName="firstName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.lastName' | translate }}</mat-label>
          <input matInput formControlName="lastName" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.fields.role' | translate }}</mat-label>
          <mat-select formControlName="role">
            <mat-option value="member">{{ 'users.roles.member' | translate }}</mat-option>
            <mat-option value="admin">{{ 'users.roles.admin' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | translate }}</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="form.invalid">
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
  imports: [MatButtonModule, MatDialogModule, MatIconModule, TranslatePipe],
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
          [attr.aria-label]="
            (copied() ? 'users.password.copied' : 'users.password.copyPassword') | translate
          "
        >
          <mat-icon>{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
          {{ (copied() ? 'users.password.copied' : 'users.password.copy') | translate }}
        </button>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" type="button" mat-dialog-close>
        {{ 'users.password.done' | translate }}
      </button>
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
    TranslatePipe,
    LdButtonComponent,
    LdEmptyStateComponent,
    LdPageFrameComponent,
    LdPageHeaderComponent,
  ],
  templateUrl: './users-page.component.html',
  styleUrl: './users-page.component.scss',
})
export class UsersPageComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

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
        this.error.set(apiErrorMessage(err, this.translate.instant('users.loadError')));
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
            title: this.translate.instant('users.password.userCreated'),
            message: this.translate.instant('users.password.firstSignInMessage'),
            temporaryPassword: created.temporaryPassword ?? '',
          });
        },
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, this.translate.instant('users.createError'))),
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
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, this.translate.instant('users.updateError'))),
      });
    });
  }

  protected resetPassword(user: ManagedUser): void {
    if (
      !confirm(
        this.translate.instant('users.password.resetConfirm', { email: user.email }),
      )
    ) {
      return;
    }
    this.auth.resetUserPassword(user.userUuid).subscribe({
      next: (updated) => {
        this.reload();
        this.showTemporaryPassword({
          title: this.translate.instant('users.password.resetTitle'),
          message: this.translate.instant('users.password.nextSignInMessage'),
          temporaryPassword: updated.temporaryPassword ?? '',
        });
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, this.translate.instant('users.password.resetError'))),
    });
  }

  protected deactivate(user: ManagedUser): void {
    if (!confirm(this.translate.instant('users.deactivateConfirm', { email: user.email }))) {
      return;
    }
    this.auth.deactivateUser(user.userUuid).subscribe({
      next: () => this.reload(),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, this.translate.instant('users.deactivateError'))),
    });
  }

  private showTemporaryPassword(data: {
    title: string;
    message: string;
    temporaryPassword: string;
  }): void {
    if (!data.temporaryPassword) {
      this.error.set(this.translate.instant('users.password.missing'));
      return;
    }
    this.dialog.open(TemporaryPasswordDialogComponent, {
      width: '28rem',
      disableClose: true,
      data,
    });
  }
}
