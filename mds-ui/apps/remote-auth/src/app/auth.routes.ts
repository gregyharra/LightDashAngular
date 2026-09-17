import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { LoginPageFacade } from './core/facades/login-page.facade';
import { ResetPasswordPageFacade } from './core/facades/reset-password-page.facade';
import { SetupPageFacade } from './core/facades/setup-page.facade';
import { UsersPageFacade } from './core/facades/users-page.facade';
import { authUiFeature } from './core/store/auth-ui.reducer';
import { usersFeature } from './core/store/users.reducer';
import { LoginPageComponent } from './login-page/login-page.component';
import { ResetPasswordPageComponent } from './reset-password-page/reset-password-page.component';
import { SetupPageComponent } from './setup-page/setup-page.component';
import { UsersPageComponent } from './users-page/users-page.component';

const loginRoute = {
  path: '',
  component: LoginPageComponent,
  providers: [provideState(authUiFeature), LoginPageFacade],
} satisfies Routes[number];

const setupRoute = {
  path: '',
  component: SetupPageComponent,
  providers: [provideState(authUiFeature), SetupPageFacade],
} satisfies Routes[number];

const resetPasswordRoute = {
  path: '',
  component: ResetPasswordPageComponent,
  providers: [provideState(authUiFeature), ResetPasswordPageFacade],
} satisfies Routes[number];

const usersRoute = {
  path: '',
  component: UsersPageComponent,
  providers: [provideState(usersFeature), UsersPageFacade],
} satisfies Routes[number];

export const LOGIN_REMOTE_ROUTES: Routes = [loginRoute];
export const SETUP_REMOTE_ROUTES: Routes = [setupRoute];
export const RESET_PASSWORD_REMOTE_ROUTES: Routes = [resetPasswordRoute];
export const USERS_REMOTE_ROUTES: Routes = [usersRoute];

export const AUTH_REMOTE_ROUTES: Routes = [
  { ...loginRoute, path: 'login' },
  { ...setupRoute, path: 'setup' },
  { ...resetPasswordRoute, path: 'reset-password' },
  { ...usersRoute, path: 'users' },
];
