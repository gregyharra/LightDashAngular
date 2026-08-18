import { Observable, of, Subject, throwError } from 'rxjs';
import { MetricQuery } from '../../core/models/explore.model';
import { ExportDialogComponent } from './export-dialog.component';
import { ExportPollResult } from './export.models';
import { startExport, StartExportOptions } from './start-export';

const METRIC_QUERY: MetricQuery = {
  exploreName: 'orders',
  dimensions: ['orders_status'],
  metrics: ['orders_count'],
  filters: {},
  sorts: [],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

describe('startExport', () => {
  const fileUrl = '/api/v2/projects/proj-1/exports/e1/file';

  function createHarness(overrides: {
    dialogResult?: Observable<{ overrideRowCap: boolean } | undefined>;
    createResult?: Observable<{ exportUuid: string }>;
    pollResult?: Observable<ExportPollResult>;
    createError?: unknown;
    pollError?: unknown;
  } = {}) {
    const create = jasmine.createSpy('create').and.returnValue(
      overrides.createError
        ? throwError(() => overrides.createError)
        : (overrides.createResult ?? of({ exportUuid: 'e1' })),
    );
    const poll = jasmine.createSpy('poll').and.returnValue(
      overrides.pollError
        ? throwError(() => overrides.pollError)
        : (overrides.pollResult ??
            of({ status: 'ready', truncated: false, rowCount: 10, format: 'csv' })),
    );
    const startBrowserDownload = jasmine.createSpy('startBrowserDownload');
    const open = jasmine
      .createSpy('open')
      .and.returnValue(
        overrides.dialogResult ?? of({ overrideRowCap: false }),
      );
    const snackBarOpen = jasmine.createSpy('open').and.returnValue({
      onAction: () => new Subject<void>().asObservable(),
    });

    const opts: StartExportOptions = {
      dialog: { open },
      exportService: {
        create,
        poll,
        fileUrl: (projectUuid: string, exportUuid: string) =>
          `/api/v2/projects/${projectUuid}/exports/${exportUuid}/file`,
        startBrowserDownload,
      },
      snackBar: { open: snackBarOpen },
      projectUuid: 'proj-1',
      metricQuery: METRIC_QUERY,
      format: 'csv',
      csvMaxLimit: 5_000_000,
      filenameBase: 'orders',
    };

    return { opts, create, poll, startBrowserDownload, open, snackBarOpen };
  }

  it('creates an export then starts a browser download of the file URL', () => {
    const { opts, create, startBrowserDownload, open } = createHarness();

    startExport(opts);

    expect(open).toHaveBeenCalledWith(ExportDialogComponent, {
      data: {
        format: 'csv',
        csvMaxLimit: 5_000_000,
        filenameBase: 'orders',
      },
      width: '28rem',
    });
    expect(create).toHaveBeenCalledWith('proj-1', {
      metricQuery: METRIC_QUERY,
      format: 'csv',
      overrideRowCap: false,
      filenameBase: 'orders',
    });
    expect(startBrowserDownload).toHaveBeenCalledWith(fileUrl);
    expect(create).toHaveBeenCalledBefore(startBrowserDownload);
  });

  it('does not create an export when the dialog is cancelled', () => {
    const { opts, create, startBrowserDownload } = createHarness({
      dialogResult: of(undefined),
    });

    startExport(opts);

    expect(create).not.toHaveBeenCalled();
    expect(startBrowserDownload).not.toHaveBeenCalled();
  });

  it('skips the dialog and uses overrideRowCap when skipDialog is true', () => {
    const { opts, create, open } = createHarness();

    startExport({ ...opts, skipDialog: true, overrideRowCap: true });

    expect(open).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith('proj-1', jasmine.objectContaining({
      overrideRowCap: true,
    }));
  });

  it('shows a snackbar when create fails', () => {
    const { opts, snackBarOpen, startBrowserDownload } = createHarness({
      createError: { status: 'error', error: { message: 'Compile failed' } },
    });

    startExport(opts);

    expect(startBrowserDownload).not.toHaveBeenCalled();
    expect(snackBarOpen).toHaveBeenCalledWith(
      'Compile failed',
      jasmine.any(String),
      jasmine.objectContaining({ duration: 8000 }),
    );
  });

  it('shows a snackbar when poll reports an error', () => {
    const { opts, snackBarOpen } = createHarness({
      pollResult: of({ status: 'error', error: 'Warehouse timeout' }),
    });

    startExport(opts);

    expect(snackBarOpen).toHaveBeenCalledWith(
      'Warehouse timeout',
      jasmine.any(String),
      jasmine.objectContaining({ duration: 8000 }),
    );
  });

  it('offers Export all rows when the file is truncated', () => {
    const action$ = new Subject<void>();
    const { opts, create, snackBarOpen, startBrowserDownload } = createHarness({
      pollResult: of({
        status: 'ready',
        truncated: true,
        rowCount: 5_000_000,
        format: 'csv',
      }),
    });
    snackBarOpen.and.returnValue({ onAction: () => action$ });

    startExport(opts);

    expect(startBrowserDownload).toHaveBeenCalledWith(fileUrl);
    expect(startBrowserDownload).toHaveBeenCalledTimes(2);
    expect(snackBarOpen).toHaveBeenCalledWith(
      'File contains the first 5,000,000 rows.',
      'Export all rows',
      jasmine.objectContaining({ duration: 8000 }),
    );

    create.calls.reset();
    action$.next();

    expect(create).toHaveBeenCalledWith(
      'proj-1',
      jasmine.objectContaining({ overrideRowCap: true }),
    );
  });
});
