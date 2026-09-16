import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AppStateService } from '../services/app-state.service';

/** 401s that mean the session cookie is missing/invalid — not credential check failures. */
const SESSION_EXPIRED_MESSAGES = new Set(['Authentication required']);

function readErrorMessage(error: unknown): string | null {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    if (typeof body === 'object' && body && 'error' in body) {
      const message = (body as { error?: { message?: unknown } }).error?.message;
      if (typeof message === 'string') {
        return message;
      }
    }
    if (typeof body === 'object' && body && typeof (body as { detail?: unknown }).detail === 'string') {
      return (body as { detail: string }).detail;
    }
    return null;
  }

  if (
    typeof error === 'object' &&
    error &&
    'error' in error &&
    typeof (error as { error?: { message?: unknown } }).error?.message === 'string'
  ) {
    return (error as { error: { message: string } }).error.message;
  }

  return null;
}

function isSessionExpired401(error: unknown, status: number | null): boolean {
  if (status !== 401) {
    return false;
  }
  const message = readErrorMessage(error);
  return message !== null && SESSION_EXPIRED_MESSAGES.has(message);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const appState = inject(AppStateService);

  return next(req).pipe(
    catchError((error: unknown) => {
      const status =
        error instanceof HttpErrorResponse
          ? error.status
          : typeof error === 'object' &&
              error &&
              'error' in error &&
              typeof (error as { error?: { statusCode?: number } }).error?.statusCode === 'number'
            ? (error as { error: { statusCode: number } }).error.statusCode
            : null;

      if (isSessionExpired401(error, status)) {
        const url = router.url;
        if (
          !url.startsWith('/login') &&
          !url.startsWith('/setup') &&
          !url.startsWith('/reset-password')
        ) {
          appState.clearUser();
          void router.navigate(['/login'], {
            queryParams: { redirect: url },
          });
        }
      }

      return throwError(() => error);
    }),
  );
};
