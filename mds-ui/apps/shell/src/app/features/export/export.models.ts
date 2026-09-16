import { MetricQuery } from '../../core/models/explore.model';

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
