import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { Dashboard } from '../../../core/models/dashboard.model';
import { DashboardService } from '../dashboard.service';
import { DashboardViewPageComponent } from './dashboard-view-page.component';

function createDashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    uuid: 'dash-1',
    name: 'Sales dashboard',
    description: 'Overview',
    slug: 'sales-dashboard',
    projectUuid: 'project-1',
    spaceUuid: 'space-1',
    spaceName: 'Shared',
    dashboardVersionId: 1,
    versionUuid: 'version-1',
    updatedAt: '2026-01-01T00:00:00.000Z',
    views: 3,
    firstViewedAt: null,
    pinnedListUuid: null,
    pinnedListOrder: null,
    tiles: [],
    tabs: [{ uuid: 'tab-1', name: 'Main', order: 0 }],
    filters: { dimensions: [], metrics: [], tableCalculations: [] },
    inheritsFromOrgOrProject: false,
    access: null,
    colorPaletteUuid: null,
    verification: null,
    ...overrides,
  };
}

type ComponentInternals = {
  isDirty: () => boolean;
  canDeactivate: () => boolean;
  onFiltersChange: (filters: Dashboard['filters']['dimensions']) => void;
  openSaveConfirm: () => void;
  save: () => void;
};

describe('DashboardViewPageComponent', () => {
  let fixture: ComponentFixture<DashboardViewPageComponent>;
  let component: DashboardViewPageComponent;
  let internals: ComponentInternals;
  let dashboardServiceSpy: jasmine.SpyObj<DashboardService>;
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(async () => {
    dashboardServiceSpy = jasmine.createSpyObj<DashboardService>('DashboardService', [
      'get',
      'update',
    ]);
    dashboardServiceSpy.get.and.returnValue(of(createDashboard()));

    paramMap$ = new BehaviorSubject(
      convertToParamMap({ projectUuid: 'project-1', dashboardUuid: 'dash-1' }),
    );

    await TestBed.configureTestingModule({
      imports: [DashboardViewPageComponent, NoopAnimationsModule],
      providers: [
        { provide: DashboardService, useValue: dashboardServiceSpy },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: paramMap$.asObservable() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardViewPageComponent);
    component = fixture.componentInstance;
    internals = component as unknown as ComponentInternals;
    fixture.detectChanges();
  });

  it('is not dirty right after loading the dashboard', () => {
    expect(internals.isDirty()).toBeFalse();
  });

  it('becomes dirty when filters change and allows canDeactivate to prompt', () => {
    internals.onFiltersChange([
      {
        id: 'filter-1',
        label: 'Status',
        operator: 'equals',
        target: { fieldId: 'orders_status', tableName: 'orders' },
        values: ['completed'],
      },
    ]);

    expect(internals.isDirty()).toBeTrue();

    const confirmSpy = spyOn(window, 'confirm').and.returnValue(false);
    expect(internals.canDeactivate()).toBeFalse();
    expect(confirmSpy).toHaveBeenCalled();
  });

  it('canDeactivate resolves true without prompting when clean', () => {
    const confirmSpy = spyOn(window, 'confirm');
    expect(internals.canDeactivate()).toBeTrue();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('resets baseline and clears dirty state after a successful save', () => {
    internals.onFiltersChange([
      {
        id: 'filter-1',
        label: 'Status',
        operator: 'equals',
        target: { fieldId: 'orders_status', tableName: 'orders' },
        values: ['completed'],
      },
    ]);
    expect(internals.isDirty()).toBeTrue();

    dashboardServiceSpy.update.and.returnValue(of(createDashboard()));
    internals.save();

    expect(internals.isDirty()).toBeFalse();
    expect(internals.canDeactivate()).toBeTrue();
  });

  it('keeps draft dirty and surfaces an inline error when save fails', () => {
    internals.onFiltersChange([
      {
        id: 'filter-1',
        label: 'Status',
        operator: 'equals',
        target: { fieldId: 'orders_status', tableName: 'orders' },
        values: ['completed'],
      },
    ]);

    dashboardServiceSpy.update.and.returnValue(throwError(() => new Error('boom')));
    internals.save();

    expect(internals.isDirty()).toBeTrue();
    expect((component as unknown as { saveError: () => string | null }).saveError()).toBeTruthy();
  });
});
