import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppStateService } from '../services/app-state.service';

export const authGuard: CanActivateFn = async (_route, state) => {
  const appState = inject(AppStateService);
  const router = inject(Router);

  if (!appState.isBootstrapped()) {
    await appState.bootstrap();
  }

  if (!appState.isSetupComplete()) {
    return router.createUrlTree(['/setup']);
  }

  if (!appState.isAuthenticated()) {
    return router.createUrlTree(['/login'], {
      queryParams: { redirect: state.url },
    });
  }

  return true;
};

export const guestGuard: CanActivateFn = async () => {
  const appState = inject(AppStateService);
  const router = inject(Router);

  if (!appState.isBootstrapped()) {
    await appState.bootstrap();
  }

  if (!appState.isSetupComplete()) {
    return router.createUrlTree(['/setup']);
  }

  if (appState.isAuthenticated()) {
    return router.createUrlTree(['/projects']);
  }

  return true;
};

export const setupGuard: CanActivateFn = async () => {
  const appState = inject(AppStateService);
  const router = inject(Router);

  if (!appState.isBootstrapped()) {
    await appState.bootstrap();
  }

  if (appState.isSetupComplete()) {
    if (appState.isAuthenticated()) {
      return router.createUrlTree(['/projects']);
    }
    return router.createUrlTree(['/login']);
  }

  return true;
};

export const adminGuard: CanActivateFn = async () => {
  const appState = inject(AppStateService);
  const router = inject(Router);

  if (!appState.isBootstrapped()) {
    await appState.bootstrap();
  }

  if (!appState.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }

  if (!appState.isAdmin()) {
    return router.createUrlTree(['/projects']);
  }

  return true;
};
