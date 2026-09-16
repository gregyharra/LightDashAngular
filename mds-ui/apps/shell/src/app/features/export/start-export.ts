import { EMPTY, isObservable, Observable, of, timer } from 'rxjs';
import { catchError, switchMap, take, tap } from 'rxjs/operators';
import { apiErrorMessage } from '../../core/api/lightdash-api.service';
import { MetricQuery } from '../../core/models/explore.model';
import {
  ExportDialogComponent,
  ExportDialogData,
  ExportDialogResult,
} from './export-dialog.component';
import { ExportCreateResult, ExportFormat, ExportPollResult } from './export.models';

export type StartExportOptions = {
  dialog: {
    open: (
      component: typeof ExportDialogComponent,
      config: { data: ExportDialogData; width: string },
    ) =>
      | { afterClosed: () => Observable<ExportDialogResult> }
      | Observable<ExportDialogResult>;
  };
  exportService: {
    create: (
      projectUuid: string,
      body: {
        metricQuery: MetricQuery;
        format: ExportFormat;
        overrideRowCap: boolean;
        filenameBase?: string;
      },
    ) => Observable<ExportCreateResult>;
    poll: (projectUuid: string, exportUuid: string) => Observable<ExportPollResult>;
    fileUrl: (projectUuid: string, exportUuid: string) => string;
    startBrowserDownload: (fileUrl: string) => void;
  };
  snackBar: {
    open: (
      message: string,
      action?: string,
      config?: { duration?: number },
    ) => { onAction: () => Observable<unknown> };
  };
  projectUuid: string;
  metricQuery: MetricQuery;
  format: ExportFormat;
  csvMaxLimit: number;
  filenameBase: string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  translate: (key: string, params?: Record<string, unknown>) => string;
  overrideRowCap?: boolean;
  skipDialog?: boolean;
};

export function startExport(opts: StartExportOptions): void {
  const result$ = opts.skipDialog
    ? of({ overrideRowCap: opts.overrideRowCap ?? false })
    : toDialogResult(
        opts.dialog.open(ExportDialogComponent, {
          data: {
            format: opts.format,
            csvMaxLimit: opts.csvMaxLimit,
            filenameBase: opts.filenameBase,
          },
          width: '28rem',
        }),
      );

  result$
    .pipe(
      take(1),
      switchMap((result) => {
        if (!result) {
          return EMPTY;
        }
        return runExportJob(opts, result.overrideRowCap);
      }),
    )
    .subscribe();
}

function runExportJob(opts: StartExportOptions, overrideRowCap: boolean): Observable<unknown> {
  return opts.exportService
    .create(opts.projectUuid, {
      metricQuery: opts.metricQuery,
      format: opts.format,
      overrideRowCap,
      filenameBase: opts.filenameBase,
    })
    .pipe(
      switchMap((created) => {
        const fileUrl = opts.exportService.fileUrl(opts.projectUuid, created.exportUuid);
        opts.exportService.startBrowserDownload(fileUrl);
        return pollExport(opts.exportService, opts.projectUuid, created.exportUuid).pipe(
          tap((poll) => handlePollResult(opts, poll, fileUrl)),
        );
      }),
      catchError((err) => {
        openSnackbar(
          opts,
          apiErrorMessage(err, opts.translate('export.startError')),
          opts.translate('common.dismiss'),
        );
        return EMPTY;
      }),
    );
}

function handlePollResult(
  opts: StartExportOptions,
  poll: ExportPollResult,
  fileUrl: string,
): void {
  if (poll.status === 'error') {
    openSnackbar(
      opts,
      poll.error?.trim() || opts.translate('export.failed'),
      opts.translate('common.dismiss'),
    );
    return;
  }

  if (poll.status !== 'ready') {
    return;
  }

  if (poll.truncated) {
    opts.exportService.startBrowserDownload(fileUrl);
    const n = opts.formatNumber(poll.rowCount ?? opts.csvMaxLimit);
    openSnackbar(
      opts,
      opts.translate('export.truncated', { count: n }),
      opts.translate('export.allRows'),
    )
      .onAction()
      .subscribe(() => {
        startExport({ ...opts, overrideRowCap: true, skipDialog: true });
      });
    return;
  }

  openSnackbar(
    opts,
    opts.translate('export.downloadHint'),
    opts.translate('export.downloadFile'),
  )
    .onAction()
    .subscribe(() => {
      opts.exportService.startBrowserDownload(fileUrl);
    });
}

function pollExport(
  exportService: StartExportOptions['exportService'],
  projectUuid: string,
  exportUuid: string,
  backoffMs = 100,
): Observable<ExportPollResult> {
  return exportService.poll(projectUuid, exportUuid).pipe(
    switchMap((poll) => {
      if (poll.status === 'ready' || poll.status === 'error') {
        return of(poll);
      }
      return timer(backoffMs).pipe(
        switchMap(() =>
          pollExport(exportService, projectUuid, exportUuid, Math.min(backoffMs * 2, 1000)),
        ),
      );
    }),
  );
}

function toDialogResult(
  opened:
    | { afterClosed: () => Observable<ExportDialogResult> }
    | Observable<ExportDialogResult>,
): Observable<ExportDialogResult> {
  if (isObservable(opened)) {
    return opened;
  }
  if (opened && typeof opened.afterClosed === 'function') {
    return opened.afterClosed();
  }
  return of(undefined);
}

function openSnackbar(
  opts: StartExportOptions,
  message: string,
  action: string,
): { onAction: () => Observable<unknown> } {
  return opts.snackBar.open(message, action, { duration: 8000 });
}
