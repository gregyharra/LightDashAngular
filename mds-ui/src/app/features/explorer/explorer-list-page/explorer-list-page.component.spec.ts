import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ExplorerService } from '../explorer.service';
import { ExplorerListPageComponent } from './explorer-list-page.component';

describe('ExplorerListPageComponent', () => {
  let fixture: ComponentFixture<ExplorerListPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExplorerListPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectUuid: 'project-1' })),
          },
        },
        { provide: ExplorerService, useValue: { listExplores: () => of([]) } },
        {
          provide: ApiErrorService,
          useValue: {
            showTransient: (_error: unknown, message: string) => message,
          },
        },
        {
          provide: LanguageService,
          useValue: { language: () => 'en', formatDate: () => 'Jan 1, 2024' },
        },
        {
          provide: ActiveProjectService,
          useValue: { setActiveProject: () => undefined },
        },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      nav: { home: 'Home' },
      charts: { breadcrumb: 'Table breadcrumb' },
      tables: { title: 'Tables' },
      explorer: {
        selectModelToQuery: 'Select a model to query.',
        noExplores: 'No tables.',
      },
    });

    fixture = TestBed.createComponent(ExplorerListPageComponent);
    fixture.detectChanges();
  });

  it('renders the design-system page chrome and empty state without a create action', () => {
    expect(fixture.debugElement.query(By.css('ld-page-frame'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ld-page-header'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('ld-page-header ld-button[ldActions]')),
    ).toBeNull();
    expect(fixture.debugElement.query(By.css('ld-empty-state'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('.explorer-list__empty')),
    ).toBeNull();
  });
});
