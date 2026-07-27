import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AppStateService } from '../services/app-state.service';

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

      if (status === 401) {
        const url = router.url;
        if (!url.startsWith('/login') && !url.startsWith('/setup')) {
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
