import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AppStateService } from '../services/app-state.service';

function redirectIfMustChangePassword(appState: AppStateService, router: Router) {
  if (appState.isAuthenticated() && appState.mustChangePassword()) {
    return router.createUrlTree(['/reset-password']);
  }
  return null;
}

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

  const mustChange = redirectIfMustChangePassword(appState, router);
  if (mustChange) {
    return mustChange;
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
    const mustChange = redirectIfMustChangePassword(appState, router);
    if (mustChange) {
      return mustChange;
    }
    return router.createUrlTree(['/projects']);
  }

  return true;
};

export const resetPasswordGuard: CanActivateFn = async (route) => {
  const appState = inject(AppStateService);
  const router = inject(Router);

  if (!appState.isBootstrapped()) {
    await appState.bootstrap();
  }

  if (!appState.isSetupComplete()) {
    return router.createUrlTree(['/setup']);
  }

  const token = route.queryParamMap.get('token');
  if (appState.isAuthenticated() && !appState.mustChangePassword() && !token) {
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
      const mustChange = redirectIfMustChangePassword(appState, router);
      if (mustChange) {
        return mustChange;
      }
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

  const mustChange = redirectIfMustChangePassword(appState, router);
  if (mustChange) {
    return mustChange;
  }

  if (!appState.isAdmin()) {
    return router.createUrlTree(['/projects']);
  }

  return true;
};
