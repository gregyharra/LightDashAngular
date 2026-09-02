import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import {
  provideTranslateService,
  TranslateService,
} from '@ngx-translate/core';
import { of } from 'rxjs';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { ProjectSummary } from '../../../core/models/project.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { ProjectsService } from '../projects.service';
import { ProjectsPageComponent } from './projects-page.component';

const PROJECTS: ProjectSummary[] = [
  {
    projectUuid: 'project-1',
    name: 'Reporting V2',
    type: 'DEFAULT',
    description: 'Finance and operations reporting domain.',
    createdByUserUuid: null,
    createdByUserName: 'Ada',
    createdAt: '2024-01-01T00:00:00.000Z',
    upstreamProjectUuid: null,
    warehouseType: 'trino',
    expiresAt: null,
  },
  {
    projectUuid: 'project-2',
    name: 'Risk Analytics',
    type: 'DEFAULT',
    createdByUserUuid: null,
    createdByUserName: null,
    createdAt: '2024-02-01T00:00:00.000Z',
    upstreamProjectUuid: null,
    warehouseType: 'bigquery',
    expiresAt: null,
  },
];

describe('ProjectsPageComponent', () => {
  let fixture: ComponentFixture<ProjectsPageComponent>;
  let router: Router;
  let routeData: { management?: boolean };

  async function setup(
    management = false,
    projects: ProjectSummary[] = PROJECTS,
  ): Promise<void> {
    routeData = { management };

    await TestBed.configureTestingModule({
      imports: [ProjectsPageComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        ActiveProjectService,
        {
          provide: Store,
          useValue: { dispatch: () => undefined, select: () => of(null) },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            data: of(routeData),
            snapshot: { data: routeData },
          },
        },
        {
          provide: ProjectsService,
          useValue: { list: () => of(projects) },
        },
        {
          provide: ApiErrorService,
          useValue: { showTransient: (_e: unknown, msg: string) => msg },
        },
        {
          provide: AppStateService,
          useValue: {
            isAdmin: signal(true).asReadonly(),
            health: signal(null).asReadonly(),
            user: signal(null).asReadonly(),
          },
        },
        {
          provide: LanguageService,
          useValue: {
            formatDate: () => 'Jan 1, 2024',
          },
        },
      ],
    }).compileComponents();

    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', {
      projects: {
        title: 'Projects',
        managementSubtitle: 'Manage projects.',
        exploreSubtitle: 'Select a project.',
        createNew: 'Create new',
        empty: 'No projects.',
        current: 'Current',
        editSettings: 'Edit project settings',
        created: 'Created',
        open: 'Open',
        domainFallback: 'Explore metrics, charts, and dashboards.',
        loadError: 'Failed to load projects.',
      },
    });

    fixture = TestBed.createComponent(ProjectsPageComponent);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  }

  it('renders domain cards on the home projects page without favorite stars', async () => {
    await setup(false);

    expect(fixture.debugElement.query(By.css('ld-page-frame'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('ld-page-header'))).toBeTruthy();

    const cards = fixture.debugElement.queryAll(By.css('.domain-card'));
    expect(cards.length).toBe(2);

    const first = cards[0].nativeElement as HTMLElement;
    expect(first.querySelector('.domain-card__title')?.textContent?.trim()).toBe(
      'Reporting V2',
    );
    expect(first.querySelector('.domain-card__desc')?.textContent?.trim()).toBe(
      'Finance and operations reporting domain.',
    );
    expect(first.querySelector('.domain-card__go')).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.domain-card__star'))).toBeNull();

    const second = cards[1].nativeElement as HTMLElement;
    expect(second.querySelector('.domain-card__desc')?.textContent?.trim()).toBe(
      'Explore metrics, charts, and dashboards.',
    );
  });

  it('opens explore when a domain card is activated', async () => {
    await setup(false);
    const active = TestBed.inject(ActiveProjectService);

    const card = fixture.debugElement.query(By.css('.domain-card'));
    card.triggerEventHandler('click', null);
    fixture.detectChanges();

    expect(active.activeProjectUuid()).toBe('project-1');
    expect(router.navigate).toHaveBeenCalledWith([
      '/projects',
      'project-1',
      'explore',
    ]);
  });

  it('keeps management create and edit affordances', async () => {
    await setup(true);

    expect(
      fixture.debugElement.query(By.css('ld-page-header ld-button[ldActions]')),
    ).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.domain-card'))).toBeNull();

    const adminCards = fixture.debugElement.queryAll(By.css('.project-card'));
    expect(adminCards.length).toBe(2);
    expect(
      fixture.debugElement.queryAll(By.css('.project-card__settings-btn')).length,
    ).toBe(2);

    const settingsBtn = fixture.debugElement.query(By.css('.project-card__settings-btn'));
    settingsBtn.triggerEventHandler('click', { stopPropagation: () => undefined });
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith([
      '/settings/projects',
      'project-1',
      'edit',
    ]);
  });

  it('renders the design-system empty state when there are no projects', async () => {
    await setup(false, []);

    expect(fixture.debugElement.query(By.css('ld-empty-state'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('.projects__empty'))).toBeNull();
  });
});
