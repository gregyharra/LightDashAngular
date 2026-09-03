import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { DictionaryEntry } from '../../../core/models/dictionary.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { LineageService } from '../../lineage/lineage.service';
import { DictionaryService } from '../dictionary.service';
import { ModelJoinsService } from '../model-joins.service';
import { TableHubPageComponent } from './table-hub-page.component';

const ENTRY: DictionaryEntry = {
  id: 'model.orders',
  name: 'orders',
  type: 'model',
  tags: [],
  custom: {},
  columns: [],
  hasOverlay: false,
};

describe('TableHubPageComponent chrome', () => {
  let fixture: ComponentFixture<TableHubPageComponent>;

  async function setup(tableId: string | null): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [TableHubPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(
              convertToParamMap({ projectUuid: 'project-1', tableId }),
            ),
          },
        },
        {
          provide: DictionaryService,
          useValue: {
            quality: () =>
              of({
                score: 100,
                models: { described: 1, total: 1 },
                columns: { described: 0, total: 0 },
              }),
            get: () => of(ENTRY),
          },
        },
        {
          provide: LineageService,
          useValue: {
            getDbtTree: () => of({ root: [] }),
            getProjectLineage: () => of({ nodes: [], edges: [] }),
          },
        },
        {
          provide: ModelJoinsService,
          useValue: { list: () => of([]) },
        },
        {
          provide: LanguageService,
          useValue: { language: () => 'en' },
        },
        {
          provide: ActiveProjectService,
          useValue: { setActiveProject: () => undefined },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TableHubPageComponent);
    if (tableId) {
      (
        fixture.componentInstance as unknown as { enableTagEditing: boolean }
      ).enableTagEditing = true;
    }
    fixture.detectChanges();
  }

  afterEach(() => TestBed.resetTestingModule());

  it('uses a wide page frame and design-system picker empty state', async () => {
    await setup(null);

    const pageFrame = fixture.debugElement.query(By.css('ld-page-frame'));
    expect(pageFrame).toBeTruthy();
    expect(pageFrame.componentInstance.wide()).toBeTrue();
    const frameContent = pageFrame.query(By.css('.ld-page-frame__container'))
      .nativeElement as HTMLElement;
    expect(getComputedStyle(frameContent).paddingLeft).toBe('20px');
    expect(fixture.debugElement.query(By.css('ld-empty-state'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.table-hub__empty'))).toBeNull();
  });

  it('uses Ld buttons for page-level explore and save actions', async () => {
    await setup('model.orders');

    expect(
      fixture.debugElement.query(By.css('ld-button.table-hub__explore-btn')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('ld-button.table-hub__save-btn')),
    ).toBeTruthy();
  });
});
