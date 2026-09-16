import { Injectable, inject, isDevMode } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { apiErrorMessage } from '../api/lightdash-api.service';

@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  showTransient(error: unknown, fallback?: string): string {
    const message = apiErrorMessage(error, fallback);
    this.snackBar.open(message, this.translate.instant('common.dismiss'), {
      duration: 8000,
      panelClass: 'api-error-snackbar',
    });
    return message;
  }

  queryErrorWarning(error: unknown): {
    code: string;
    message: string;
    severity: 'error';
  } {
    return queryErrorWarning(
      error,
      this.translate.instant('common.queryFailed'),
    );
  }
}

export function queryErrorWarning(
  error: unknown,
  fallback: string,
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
