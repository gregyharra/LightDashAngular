import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { Explore } from '../../../core/models/explore.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { ExportService } from '../../export/export.service';
import { LineageService } from '../../lineage/lineage.service';
import { ExplorerService } from '../explorer.service';
import { ExplorerPageComponent } from './explorer-page.component';

const EXPLORE: Explore = {
  name: 'orders',
  label: 'Orders',
  tags: [],
  baseTable: 'orders',
  joinedTables: [],
  tables: {},
  targetDatabase: 'analytics',
};

describe('ExplorerPageComponent chrome', () => {
  let fixture: ComponentFixture<ExplorerPageComponent>;

  async function setup(tableId: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ExplorerPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectUuid: 'project-1', tableId })),
          },
        },
        {
          provide: Store,
          useValue: { dispatch: () => undefined, select: () => of({}) },
        },
        {
          provide: ExplorerService,
          useValue: {
            listExplores: () => of([]),
            getExplore: () => of(EXPLORE),
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
        { provide: AppStateService, useValue: { health: signal(null) } },
        {
          provide: LanguageService,
          useValue: {
            language: signal('en'),
            formatNumber: (value: number) => String(value),
          },
        },
        {
          provide: ActiveProjectService,
          useValue: { setActiveProject: () => undefined },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ExplorerPageComponent);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses a wide page frame and shared UI picker empty state', async () => {
    await setup(null);

    const pageFrame = fixture.debugElement.query(By.css('dpf-page-frame'));
    expect(pageFrame).toBeTruthy();
    expect(pageFrame.componentInstance.wide()).toBeTrue();
    expect(fixture.debugElement.query(By.css('dpf-empty-state'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.explorer-page__empty'))).toBeNull();
  });

  it('keeps the shared run widget and uses a Dpf create action', async () => {
    await setup('orders');

    expect(
      fixture.debugElement.query(By.css('app-run-query-button')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('dpf-button.explorer-page__action-btn')),
    ).toBeTruthy();
  });
});
