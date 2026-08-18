import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { MetricQuery } from '../../core/models/explore.model';
import { ExportRequestBody } from './export.models';
import { ExportService } from './export.service';

const METRIC_QUERY: MetricQuery = {
  exploreName: 'orders',
  dimensions: [],
  metrics: [],
  filters: {},
  sorts: [],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

const CREATE_BODY: ExportRequestBody = {
  metricQuery: METRIC_QUERY,
  format: 'csv',
  overrideRowCap: false,
};

describe('ExportService', () => {
  let service: ExportService;
  let post: jasmine.Spy;
  let get: jasmine.Spy;

  beforeEach(() => {
    post = jasmine.createSpy('post').and.returnValue(of({ exportUuid: 'export-1' }));
    get = jasmine.createSpy('get').and.returnValue(
      of({ status: 'ready', truncated: false, rowCount: 0, format: 'csv' }),
    );

    TestBed.configureTestingModule({
      providers: [
        ExportService,
        {
          provide: LightdashApiService,
          useValue: { post, get },
        },
      ],
    });
    service = TestBed.inject(ExportService);
  });

  it('posts create to /projects/p/exports with csv body', (done) => {
    service.create('p', CREATE_BODY).subscribe((result) => {
      expect(post).toHaveBeenCalledWith('/projects/p/exports', CREATE_BODY, {
        apiVersion: 'v2',
      });
      expect(result).toEqual({ exportUuid: 'export-1' });
      done();
    });
  });

  it('polls export status over v2', (done) => {
    service.poll('p', 'u').subscribe((result) => {
      expect(get).toHaveBeenCalledWith('/projects/p/exports/u', { apiVersion: 'v2' });
      expect(result.status).toBe('ready');
      done();
    });
  });

  it('returns the same-origin file url', () => {
    expect(service.fileUrl('p', 'u')).toBe('/api/v2/projects/p/exports/u/file');
  });
});
