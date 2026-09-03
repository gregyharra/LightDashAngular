import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { LanguageService } from '../../../core/i18n/language.service';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { SpaceService } from '../../spaces/space.service';
import { DashboardService } from '../dashboard.service';
import { DashboardCreatePageComponent } from './dashboard-create-page.component';

describe('DashboardCreatePageComponent', () => {
  let fixture: ComponentFixture<DashboardCreatePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardCreatePageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectUuid: 'project-1' })),
          },
        },
        {
          provide: SpaceService,
          useValue: { list: () => of([]) },
        },
        {
          provide: DashboardService,
          useValue: {},
        },
        {
          provide: ActiveProjectService,
          useValue: { setActiveProject: () => undefined },
        },
        {
          provide: LanguageService,
          useValue: { language: signal('en').asReadonly() },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardCreatePageComponent);
    fixture.detectChanges();
  });

  it('renders shared UI page chrome and form actions', () => {
    expect(fixture.debugElement.query(By.css('dpf-page-frame'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('dpf-page-header'))).toBeTruthy();
    expect(
      fixture.debugElement.query(By.css('dpf-button[type="submit"]')),
    ).toBeTruthy();
    expect(
      fixture.debugElement.query(
        By.css('dpf-button[variant="outlined"][tone="neutral"]'),
      ),
    ).toBeTruthy();
  });
});
