import { Injectable, inject, isDevMode } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { apiErrorMessage } from '../api/lightdash-api.service';

@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  private readonly snackBar = inject(MatSnackBar);

  showTransient(error: unknown, fallback?: string): string {
    const message = apiErrorMessage(error, fallback);
    this.snackBar.open(message, 'Dismiss', {
      duration: 8000,
      panelClass: 'api-error-snackbar',
    });
    return message;
  }
}

export function queryErrorWarning(
  error: unknown,
  fallback = 'Failed to run query.',
): { code: string; message: string; severity: 'error' } {
  return {
    code: 'QUERY_FAILED',
    message: apiErrorMessage(error, fallback),
    severity: 'error',
  };
}

export function devStatusHint(statusCode: number | undefined): string {
  if (!isDevMode() || !statusCode) {
    return '';
  }

  return ` (HTTP ${statusCode})`;
}
