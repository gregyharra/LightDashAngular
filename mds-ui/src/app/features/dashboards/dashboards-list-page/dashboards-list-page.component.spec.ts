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
import { DashboardService } from '../dashboard.service';
import { DashboardsListPageComponent } from './dashboards-list-page.component';

describe('DashboardsListPageComponent', () => {
  let fixture: ComponentFixture<DashboardsListPageComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardsListPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectUuid: 'project-1' })),
          },
        },
        { provide: DashboardService, useValue: { list: () => of([]) } },
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
      dashboards: {
        title: 'Dashboards',
        all: 'All dashboards',
        breadcrumb: 'Dashboard breadcrumb',
        empty: 'No dashboards.',
        create: { action: 'Create dashboard' },
      },
    });

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(DashboardsListPageComponent);
    fixture.detectChanges();
  });

  it('renders the design-system page chrome and empty state', () => {
    expect(fixture.debugElement.query(By.css('ld-page-frame'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ld-page-header'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('ld-page-header ld-button[ldActions]')),
    ).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ld-empty-state'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('ld-empty-state ld-button[ldCta]')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('.dashboards-list__empty')),
    ).toBeNull();
  });

  it('opens the create page from the design-system action', () => {
    fixture.debugElement
      .query(By.css('ld-page-header ld-button[ldActions]'))
      .triggerEventHandler('click');

    expect(router.navigate).toHaveBeenCalledWith([
      '/projects',
      'project-1',
      'dashboards',
      'create',
    ]);
  });
});
