import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { Explore, ExploreSummary } from '../../../core/models/explore.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { ChartService } from '../../charts/chart.service';
import { LineageService } from '../../lineage/lineage.service';
import { ExplorerService } from '../explorer.service';
import { TablesWorkspacePageComponent } from './tables-workspace-page.component';

const SUMMARY: ExploreSummary = {
  name: 'orders',
  label: 'Orders',
  tags: [],
  schemaName: 'public',
  databaseName: 'analytics',
  lineageNodeId: 'model.orders',
};

const EXPLORE: Explore = {
  name: 'orders',
  label: 'Orders',
  tags: [],
  baseTable: 'orders',
  joinedTables: [],
  targetDatabase: 'analytics',
  tables: {
    orders: {
      name: 'orders',
      label: 'Orders',
      database: 'analytics',
      schema: 'public',
      sqlTable: 'analytics.public.orders',
      dimensions: {
        id: {
          fieldType: 'dimension',
          type: 'string',
          name: 'id',
          label: 'ID',
          table: 'orders',
          tableLabel: 'Orders',
          sql: '${TABLE}.id',
          hidden: false,
        },
      },
      metrics: {},
    },
  },
};

describe('TablesWorkspacePageComponent chrome', () => {
  let fixture: ComponentFixture<TablesWorkspacePageComponent>;

  async function setup(tableId: string | null): Promise<void> {
    const paramMap = convertToParamMap({ projectUuid: 'project-1' });
    const queryParamMap = convertToParamMap(tableId ? { table: tableId } : {});

    await TestBed.configureTestingModule({
      imports: [TablesWorkspacePageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(paramMap),
            queryParamMap: of(queryParamMap),
            snapshot: { paramMap, queryParamMap },
          },
        },
        {
          provide: Store,
          useValue: { dispatch: () => undefined, select: () => of({}) },
        },
        {
          provide: ExplorerService,
          useValue: {
            listExplores: () => of([SUMMARY]),
            getExplore: () => of(EXPLORE),
          },
        },
        {
          provide: LineageService,
          useValue: {
            getDbtTree: () =>
              of({
                root: [
                  {
                    id: 'model.orders',
                    name: 'orders',
                    path: 'models/orders.sql',
                    type: 'model',
                    lineageNodeId: 'model.orders',
                  },
                ],
              }),
            getProjectLineage: () => of({ nodes: [] }),
          },
        },
        { provide: ChartService, useValue: {} },
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

    fixture = TestBed.createComponent(TablesWorkspacePageComponent);
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses design-system empty states before a model is selected', async () => {
    await setup(null);

    expect(
      fixture.debugElement.queryAll(By.css('ld-empty-state')).length,
    ).toBeGreaterThan(0);
    expect(
      fixture.debugElement.query(
        By.css('.tables-workspace__panel-empty--centered'),
      ),
    ).toBeNull();
  });

  it('keeps the shared run widget and uses an Ld save action', async () => {
    await setup('model.orders');

    expect(
      fixture.debugElement.query(By.css('app-run-query-button')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('ld-button.tables-workspace__toolbar-btn')),
    ).toBeTruthy();
  });
});
