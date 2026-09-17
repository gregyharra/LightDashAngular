import { Routes } from '@angular/router';
import { AUTH_REMOTE_ROUTES } from './auth.routes';
import { AuthEntryComponent } from './remote-entry/entry';

export const appRoutes: Routes = [
  {
    path: '',
    component: AuthEntryComponent,
    children: AUTH_REMOTE_ROUTES,
  },
];
