import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { Dashboard } from '../../../core/models/dashboard.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ChartService } from '../../charts/chart.service';
import { ExplorerService } from '../../explorer/explorer.service';
import { DashboardService } from '../dashboard.service';
import { DashboardViewPageComponent } from './dashboard-view-page.component';

const DASHBOARD: Dashboard = {
  uuid: 'dashboard-1',
  name: 'Revenue',
  slug: 'revenue',
  projectUuid: 'project-1',
  spaceUuid: 'space-1',
  spaceName: 'Finance',
  dashboardVersionId: 1,
  versionUuid: 'version-1',
  updatedAt: '2024-01-01T00:00:00.000Z',
  views: 1,
  firstViewedAt: null,
  pinnedListUuid: null,
  pinnedListOrder: null,
  tiles: [],
  tabs: [{ uuid: 'tab-1', name: 'Overview', order: 0 }],
  filters: { dimensions: [], metrics: [], tableCalculations: [] },
  inheritsFromOrgOrProject: false,
  access: null,
  colorPaletteUuid: null,
  verification: null,
};

describe('DashboardViewPageComponent', () => {
  let fixture: ComponentFixture<DashboardViewPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardViewPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({
                projectUuid: 'project-1',
                dashboardUuid: 'dashboard-1',
              }),
            ),
          },
        },
        { provide: DashboardService, useValue: { get: () => of(DASHBOARD) } },
        { provide: ChartService, useValue: { list: () => of([]) } },
        { provide: ExplorerService, useValue: { listExplores: () => of([]) } },
        {
          provide: ActiveProjectService,
          useValue: {
            activeProject: signal(null),
            setActiveProject: () => undefined,
          },
        },
        {
          provide: LanguageService,
          useValue: {
            language: signal('en'),
            formatDate: () => 'Jan 1, 2024',
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardViewPageComponent);
    fixture.detectChanges();
  });

  it('uses wide page frames and shared UI view actions', () => {
    const pageFrames = fixture.debugElement.queryAll(By.css('dpf-page-frame'));
    expect(pageFrames.length).toBe(2);
    expect(
      pageFrames.every((frame) => frame.componentInstance.wide()),
    ).toBeTrue();
    expect(
      fixture.debugElement.query(By.css('dpf-button.dashboard-view__edit-btn')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.queryAll(
        By.css('dpf-icon-button.dashboard-view__icon-action'),
      ).length,
    ).toBe(2);
  });

  it('uses shared UI save and cancel actions in edit mode', () => {
    fixture.debugElement
      .query(By.css('dpf-button.dashboard-view__edit-btn'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    expect(
      fixture.debugElement.query(
        By.css(
          'dpf-button.dashboard-edit__action-btn[variant="outlined"][tone="neutral"]',
        ),
      ),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('dpf-button.dashboard-edit__save-btn')),
    ).toBeTruthy();
  });
});
