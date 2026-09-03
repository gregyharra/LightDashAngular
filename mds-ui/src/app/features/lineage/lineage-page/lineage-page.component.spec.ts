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
import { ApiErrorService } from '../../../core/api/api-error.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { LineageService } from '../lineage.service';
import { LineagePageComponent } from './lineage-page.component';

describe('LineagePageComponent', () => {
  let fixture: ComponentFixture<LineagePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LineagePageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectUuid: 'project-1' })),
            snapshot: { queryParamMap: convertToParamMap({}) },
          },
        },
        {
          provide: LineageService,
          useValue: {
            getProjectLineage: () =>
              of({
                projectUuid: 'project-1',
                projectName: 'Analytics',
                warehouseType: 'snowflake',
                dbtProject: {
                  name: 'analytics',
                  version: '1.0',
                  profile: 'default',
                  lastCompiledAt: '2026-09-02T12:00:00Z',
                  modelCount: 0,
                  seedCount: 0,
                  sourceCount: 0,
                },
                nodes: [],
                edges: [],
              }),
            getDbtTree: () => of({ root: [] }),
          },
        },
        {
          provide: ApiErrorService,
          useValue: { showTransient: () => '' },
        },
        {
          provide: LanguageService,
          useValue: {
            language: signal('en').asReadonly(),
            formatDate: () => 'Sep 2, 2026',
          },
        },
        {
          provide: ActiveProjectService,
          useValue: { setActiveProject: () => undefined },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LineagePageComponent);
    fixture.detectChanges();
  });

  it('renders wide design-system page chrome with rich metadata below the header', () => {
    const frame = fixture.debugElement.query(By.css('ld-page-frame'));
    const header = fixture.debugElement.query(By.css('ld-page-header'));
    const metadata = fixture.debugElement.query(
      By.css('.lineage-page__subtitle'),
    );

    expect(frame).toBeTruthy();
    expect(frame.componentInstance.wide()).toBeTrue();
    expect(header).toBeTruthy();
    expect(header.componentInstance.title()).toBe('Analytics');
    expect(header.componentInstance.subtitle()).toBeNull();
    expect(metadata).toBeTruthy();
    expect(header.nativeElement.contains(metadata.nativeElement)).toBeFalse();
  });
});
