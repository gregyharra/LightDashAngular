import { MetricQuery } from '@mds-ui/models';

export type ExportFormat = 'csv' | 'xlsx';

export type ExportRequestBody = {
  metricQuery: MetricQuery;
  format: ExportFormat;
  overrideRowCap: boolean;
  filenameBase?: string;
};

export type ExportCreateResult = {
  exportUuid: string;
};

export type ExportPollResult = {
  status: 'pending' | 'executing' | 'ready' | 'error';
  error?: string | null;
  truncated?: boolean;
  rowCount?: number;
  format?: ExportFormat;
};

export type ExportDialogData = {
  format: ExportFormat;
  csvMaxLimit: number;
  filenameBase: string;
};

export type ExportDialogResult = { overrideRowCap: boolean } | undefined;
