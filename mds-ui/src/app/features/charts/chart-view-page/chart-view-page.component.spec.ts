import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  DEFAULT_CHART_DISPLAY_CONFIG,
  SavedChart,
  defaultConfigForType,
} from '../../../core/models/chart.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { ExplorerService } from '../../explorer/explorer.service';
import { ExportService } from '../../export/export.service';
import { LineageService } from '../../lineage/lineage.service';
import { ChartService } from '../chart.service';
import { ChartViewPageComponent } from './chart-view-page.component';

const CHART: SavedChart = {
  uuid: 'chart-1',
  name: 'Revenue',
  spaceUuid: 'space-1',
  spaceName: 'Finance',
  projectUuid: 'project-1',
  updatedAt: '2024-01-01T00:00:00.000Z',
  pinnedListUuid: null,
  pinnedListOrder: null,
  views: 1,
  firstViewedAt: '2024-01-01T00:00:00.000Z',
  isPrivate: false,
  access: [],
  chartKind: 'vertical_bar',
  tableName: 'orders',
  metricQuery: {
    exploreName: 'orders',
    dimensions: [],
    metrics: [],
    filters: {},
    sorts: [],
    limit: DEFAULT_CHART_DISPLAY_CONFIG.rowLimit,
    tableCalculations: [],
    additionalMetrics: [],
  },
  chartConfig: defaultConfigForType('cartesian'),
  updatedByUser: {
    userUuid: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
  },
};

describe('ChartViewPageComponent', () => {
  let fixture: ComponentFixture<ChartViewPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartViewPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            data: of({}),
            paramMap: of(
              convertToParamMap({
                projectUuid: 'project-1',
                chartUuid: 'chart-1',
              }),
            ),
          },
        },
        {
          provide: Store,
          useValue: {
            dispatch: () => undefined,
            select: () => of({}),
          },
        },
        { provide: ChartService, useValue: { get: () => of(CHART) } },
        {
          provide: ExplorerService,
          useValue: {
            getExplore: () => of({ name: 'orders', label: 'Orders', tables: {} }),
            listExplores: () => of([]),
          },
        },
        {
          provide: LineageService,
          useValue: {
            getDbtTree: () => of({ root: [] }),
            getProjectLineage: () => of({ nodes: [] }),
          },
        },
        { provide: ExportService, useValue: {} },
        {
          provide: AppStateService,
          useValue: { health: signal(null) },
        },
        {
          provide: ActiveProjectService,
          useValue: { setActiveProject: () => undefined },
        },
        {
          provide: LanguageService,
          useValue: {
            language: signal('en'),
            formatNumber: (value: number) => String(value),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartViewPageComponent);
    fixture.detectChanges();
  });

  it('uses a wide page frame and shared UI edit action', () => {
    const pageFrame = fixture.debugElement.query(By.css('dpf-page-frame'));
    expect(pageFrame).toBeTruthy();
    expect(pageFrame.componentInstance.wide()).toBeTrue();
    expect(
      fixture.debugElement.query(By.css('dpf-button.chart-view__edit-btn')),
    ).toBeTruthy();
  });

  it('uses shared UI toolbar actions in edit mode', () => {
    fixture.debugElement
      .query(By.css('dpf-button.chart-view__edit-btn'))
      .triggerEventHandler('click');
    fixture.detectChanges();

    const configureButton = fixture.debugElement.query(
      By.css('dpf-button.chart-view__configure-btn[variant="outlined"]'),
    );
    expect(configureButton).toBeTruthy();
    expect(
      (configureButton.query(By.css('button')).nativeElement as HTMLButtonElement)
        .getAttribute('aria-pressed'),
    ).toBe('false');
    configureButton.triggerEventHandler('click');
    fixture.detectChanges();
    expect(
      (configureButton.query(By.css('button')).nativeElement as HTMLButtonElement)
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      fixture.debugElement.query(
        By.css('dpf-button.chart-view__save-btn[variant="outlined"]'),
      ),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('dpf-button.chart-view__done-btn')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(
        By.css('dpf-icon-button.chart-view__breadcrumb-edit'),
      ),
    ).toBeTruthy();
  });
});
