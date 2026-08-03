import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { LightdashApiService } from '../api/lightdash-api.service';
import { UserProfile } from '../api/api.types';
import { AppStateService } from './app-state.service';

export type SetupPayload = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type ManagedUser = {
  userUuid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
  createdAt: string | null;
  temporaryPassword?: string;
};

export type CreateUserPayload = {
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'member';
  password?: string;
};

export type UpdateUserPayload = {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'admin' | 'member';
  isActive?: boolean;
  password?: string;
  resetPassword?: boolean;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(LightdashApiService);
  private readonly appState = inject(AppStateService);

  setup(payload: SetupPayload): Observable<UserProfile> {
    return this.api.post<UserProfile>('/setup', payload).pipe(
      switchMap((user) => from(this.appState.refresh()).pipe(switchMap(() => [user]))),
    );
  }

  login(payload: LoginPayload): Observable<UserProfile> {
    return this.api.post<UserProfile>('/login', payload).pipe(
      switchMap((user) => from(this.appState.refresh()).pipe(switchMap(() => [user]))),
    );
  }

  logout(): Observable<null> {
    return this.api.post<null>('/logout', {}).pipe(
      switchMap(() => {
        this.appState.clearUser();
        return [null];
      }),
    );
  }

  changeOwnPassword(currentPassword: string, newPassword: string): Observable<null> {
    return this.api.post<null>('/user/password', { currentPassword, newPassword });
  }

  resetPassword(payload: { newPassword: string; token?: string }): Observable<UserProfile> {
    return this.api.post<UserProfile>('/user/password/reset', payload).pipe(
      switchMap((user) => from(this.appState.refresh()).pipe(switchMap(() => [user]))),
    );
  }

  listUsers(): Observable<ManagedUser[]> {
    return this.api.get<ManagedUser[]>('/users');
  }

  createUser(payload: CreateUserPayload): Observable<ManagedUser> {
    return this.api.post<ManagedUser>('/users', payload);
  }

  updateUser(userUuid: string, patch: UpdateUserPayload): Observable<ManagedUser> {
    return this.api.patch<ManagedUser>(`/users/${userUuid}`, patch);
  }

  resetUserPassword(userUuid: string): Observable<ManagedUser> {
    return this.updateUser(userUuid, { resetPassword: true });
  }

  deactivateUser(userUuid: string): Observable<null> {
    return this.api.delete<null>(`/users/${userUuid}`);
  }
}
