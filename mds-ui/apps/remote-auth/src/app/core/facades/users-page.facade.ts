import { Injectable, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import {
  apiErrorMessage,
  AuthService,
  CreateUserPayload,
  UpdateUserPayload,
} from '@mds-ui/core';
import { UsersActions } from '../store/users.actions';
import { usersFeature } from '../store/users.reducer';

@Injectable()
export class UsersPageFacade {
  private readonly store = inject(Store);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService, { optional: true });

  readonly users = this.store.selectSignal(usersFeature.selectUsers);
  readonly loading = this.store.selectSignal(usersFeature.selectLoading);
  readonly error = this.store.selectSignal(usersFeature.selectError);
  readonly temporaryPassword = this.store.selectSignal(
    usersFeature.selectTemporaryPassword,
  );

  load(): void {
    this.store.dispatch(UsersActions.loadStarted());
    this.auth.listUsers().subscribe({
      next: (users) =>
        this.store.dispatch(UsersActions.loadSucceeded({ users })),
      error: (error: unknown) =>
        this.fail(error, 'users.loadError', 'Could not load users'),
    });
  }

  create(
    payload: CreateUserPayload,
    onTemporaryPassword?: (temporaryPassword: string) => void,
  ): void {
    this.store.dispatch(UsersActions.errorCleared());
    this.auth.createUser(payload).subscribe({
      next: (user) => {
        this.load();
        this.receiveTemporaryPassword(user.temporaryPassword);
        if (user.temporaryPassword) {
          onTemporaryPassword?.(user.temporaryPassword);
        }
      },
      error: (error: unknown) =>
        this.fail(error, 'users.createError', 'Could not create user'),
    });
  }

  update(userUuid: string, payload: UpdateUserPayload): void {
    this.store.dispatch(UsersActions.errorCleared());
    this.auth.updateUser(userUuid, payload).subscribe({
      next: () => this.load(),
      error: (error: unknown) =>
        this.fail(error, 'users.updateError', 'Could not update user'),
    });
  }

  resetPassword(
    userUuid: string,
    onTemporaryPassword?: (temporaryPassword: string) => void,
  ): void {
    this.store.dispatch(UsersActions.errorCleared());
    this.auth.resetUserPassword(userUuid).subscribe({
      next: (user) => {
        this.load();
        this.receiveTemporaryPassword(user.temporaryPassword);
        if (user.temporaryPassword) {
          onTemporaryPassword?.(user.temporaryPassword);
        }
      },
      error: (error: unknown) =>
        this.fail(
          error,
          'users.password.resetError',
          'Could not reset password',
        ),
    });
  }

  deactivate(userUuid: string): void {
    this.store.dispatch(UsersActions.errorCleared());
    this.auth.deactivateUser(userUuid).subscribe({
      next: () => this.load(),
      error: (error: unknown) =>
        this.fail(error, 'users.deactivateError', 'Could not deactivate user'),
    });
  }

  clearTemporaryPassword(): void {
    this.store.dispatch(UsersActions.temporaryPasswordCleared());
  }

  private receiveTemporaryPassword(temporaryPassword?: string): void {
    if (temporaryPassword) {
      this.store.dispatch(
        UsersActions.temporaryPasswordReceived({ temporaryPassword }),
      );
      return;
    }
    this.store.dispatch(
      UsersActions.requestFailed({
        message:
          this.translate?.instant('users.password.missing') ??
          'Temporary password was not returned',
      }),
    );
  }

  private fail(error: unknown, key: string, fallback: string): void {
    this.store.dispatch(
      UsersActions.requestFailed({
        message: apiErrorMessage(
          error,
          this.translate?.instant(key) ?? fallback,
        ),
      }),
    );
  }
}
