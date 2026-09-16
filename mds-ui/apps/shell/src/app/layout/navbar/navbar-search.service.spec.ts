import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { SavedChartBasic } from '../../core/models/chart.model';
import { DashboardBasicDetailsWithTileTypes, DashboardTileTypes } from '../../core/models/dashboard.model';
import { LineageNode, ProjectLineage } from '../../core/models/lineage.model';
import { ChartService } from '../../features/charts/chart.service';
import { DashboardService } from '../../features/dashboards/dashboard.service';
import { LineageService } from '../../features/lineage/lineage.service';
import { NavbarSearchService } from './navbar-search.service';

const PROJECT = 'project-1';

const MODEL: LineageNode = {
  id: 'model.jaffle.orders',
  name: 'orders',
  type: 'mart',
  schema: 'analytics',
  database: 'prod',
  catalog: 'iceberg',
  columnCount: 2,
  description: 'Order facts',
  tags: ['finance'],
  columns: [
    {
      name: 'order_id',
      type: 'integer',
      description: 'Primary key',
      tags: ['pk'],
      transformationType: 'rename',
    },
    {
      name: 'customer_id',
      type: 'integer',
      description: 'Buyer',
    },
  ],
};

const LINEAGE: ProjectLineage = {
  projectUuid: PROJECT,
  projectName: 'Demo',
  warehouseType: 'trino',
  dbtProject: {
    name: 'jaffle',
    version: '1.0.0',
    profile: 'jaffle',
    lastCompiledAt: '2024-01-01T00:00:00.000Z',
    modelCount: 1,
    seedCount: 0,
    sourceCount: 0,
  },
  nodes: [MODEL],
  edges: [],
};

const DASHBOARD: DashboardBasicDetailsWithTileTypes = {
  uuid: 'dash-1',
  name: 'Revenue overview',
  description: 'KPIs',
  projectUuid: PROJECT,
  spaceUuid: 'space-1',
  spaceName: 'Finance',
  updatedAt: '2024-01-01T00:00:00.000Z',
  views: 1,
  firstViewedAt: null,
  pinnedListUuid: null,
  pinnedListOrder: null,
  tileTypes: [DashboardTileTypes.SAVED_CHART],
};

const CHART: SavedChartBasic = {
  uuid: 'chart-1',
  name: 'Orders by day',
  description: 'Daily trend',
  spaceUuid: 'space-1',
  spaceName: 'Finance',
  projectUuid: PROJECT,
  updatedAt: '2024-01-01T00:00:00.000Z',
  pinnedListUuid: null,
  pinnedListOrder: null,
  views: 1,
  firstViewedAt: '2024-01-01T00:00:00.000Z',
  isPrivate: false,
  access: [],
  chartKind: 'line',
  tableName: 'orders',
};

describe('NavbarSearchService', () => {
  let service: NavbarSearchService;
  let getProjectLineage: jasmine.Spy;
  let listDashboards: jasmine.Spy;
  let listCharts: jasmine.Spy;

  beforeEach(() => {
    getProjectLineage = jasmine.createSpy('getProjectLineage').and.returnValue(of(LINEAGE));
    listDashboards = jasmine.createSpy('listDashboards').and.returnValue(of([DASHBOARD]));
    listCharts = jasmine.createSpy('listCharts').and.returnValue(of([CHART]));

    TestBed.configureTestingModule({
      providers: [
        NavbarSearchService,
        {
          provide: LineageService,
          useValue: {
            getProjectLineage,
          },
        },
        {
          provide: DashboardService,
          useValue: {
            list: listDashboards,
          },
        },
        {
          provide: ChartService,
          useValue: {
            list: listCharts,
          },
        },
      ],
    });
    service = TestBed.inject(NavbarSearchService);
  });

  it('returns grouped matches across models, columns, dashboards, and charts', (done) => {
    service.search(PROJECT, 'order').subscribe((groups) => {
      const kinds = groups.map((group) => group.kind);
      expect(kinds).toContain('model');
      expect(kinds).toContain('column');
      expect(kinds).toContain('chart');

      const model = groups.find((group) => group.kind === 'model')?.results[0];
      expect(model?.title).toBe('orders');
      expect(model?.chips.map((chip) => chip.label)).toEqual(['mart', 'analytics']);
      expect(model?.subtitle).toBe('Order facts');
      expect(model?.route).toEqual(['/projects', PROJECT, 'tables', MODEL.id]);

      const column = groups
        .find((group) => group.kind === 'column')
        ?.results.find((result) => result.title === 'order_id');
      expect(column?.chips.map((chip) => chip.label)).toEqual(['integer', 'orders', 'rename']);
      expect(column?.chips.find((chip) => chip.transformationType)?.transformationType).toBe('rename');
      expect(column?.subtitle).toBe('Primary key');
      expect(column?.route).toEqual(['/projects', PROJECT, 'tables', MODEL.id]);

      const chart = groups.find((group) => group.kind === 'chart')?.results[0];
      expect(chart?.title).toBe('Orders by day');
      expect(chart?.chips.map((chip) => chip.label)).toEqual(['line', 'orders', 'Finance']);
      expect(chart?.route).toEqual(['/projects', PROJECT, 'charts', CHART.uuid]);
      done();
    });
  });

  it('includes transformation chips only when lineage metadata is present', (done) => {
    service.search(PROJECT, 'customer_id').subscribe((groups) => {
      const column = groups
        .find((group) => group.kind === 'column')
        ?.results.find((result) => result.title === 'customer_id');
      expect(column?.chips.map((chip) => chip.label)).toEqual(['integer', 'orders']);
      expect(column?.chips.some((chip) => !!chip.transformationType)).toBeFalse();
      done();
    });
  });

  it('scopes index loading to the requested project uuid', (done) => {
    service.search(PROJECT, 'order').subscribe(() => {
      expect(getProjectLineage).toHaveBeenCalledOnceWith(PROJECT);
      expect(listDashboards).toHaveBeenCalledOnceWith(PROJECT);
      expect(listCharts).toHaveBeenCalledOnceWith(PROJECT);
      done();
    });
  });

  it('matches dashboards by space name and description', (done) => {
    service.search(PROJECT, 'finance').subscribe((groups) => {
      expect(groups.some((group) => group.kind === 'dashboard')).toBeTrue();
      expect(groups.some((group) => group.kind === 'model')).toBeTrue();
      done();
    });
  });

  it('returns empty groups for blank queries', (done) => {
    service.search(PROJECT, '   ').subscribe((groups) => {
      expect(groups).toEqual([]);
      done();
    });
  });

  it('fails soft when one source errors', (done) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        NavbarSearchService,
        {
          provide: LineageService,
          useValue: {
            getProjectLineage: () => throwError(() => new Error('lineage down')),
          },
        },
        {
          provide: DashboardService,
          useValue: {
            list: () => of([DASHBOARD]),
          },
        },
        {
          provide: ChartService,
          useValue: {
            list: () => throwError(() => new Error('charts down')),
          },
        },
      ],
    });
    const softService = TestBed.inject(NavbarSearchService);
    softService.search(PROJECT, 'revenue').subscribe((groups) => {
      expect(groups.map((group) => group.kind)).toEqual(['dashboard']);
      expect(groups[0].results[0].title).toBe('Revenue overview');
      done();
    });
  });
});
