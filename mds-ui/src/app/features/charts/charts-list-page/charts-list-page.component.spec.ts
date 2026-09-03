import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ChartService } from '../chart.service';
import { ChartsListPageComponent } from './charts-list-page.component';

describe('ChartsListPageComponent', () => {
  let fixture: ComponentFixture<ChartsListPageComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartsListPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectUuid: 'project-1' })),
          },
        },
        { provide: ChartService, useValue: { list: () => of([]) } },
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
      charts: {
        title: 'Charts',
        all: 'All charts',
        breadcrumb: 'Chart breadcrumb',
        empty: 'No charts.',
        create: 'Create chart',
      },
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ChartsListPageComponent);
    fixture.detectChanges();
  });

  it('renders the shared UI page chrome and empty state', () => {
    expect(fixture.debugElement.query(By.css('dpf-page-frame'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('dpf-page-header'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('dpf-page-header dpf-button[dpfActions]')),
    ).toBeTruthy();
    expect(fixture.debugElement.query(By.css('dpf-empty-state'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('dpf-empty-state dpf-button[dpfCta]')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('.charts-list__empty')),
    ).toBeNull();
  });

  it('navigates from the shared UI create action', () => {
    fixture.debugElement
      .query(By.css('dpf-page-header dpf-button[dpfActions]'))
      .triggerEventHandler('click');

    expect(router.navigate).toHaveBeenCalledWith([
      '/projects',
      'project-1',
      'charts',
      'new',
    ]);
  });
});
