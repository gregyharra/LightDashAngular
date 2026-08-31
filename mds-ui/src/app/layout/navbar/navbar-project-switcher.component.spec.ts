import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { ActiveProjectService } from '../../core/services/active-project.service';
import { ProjectSummary } from '../../core/models/project.model';
import { NavbarProjectSwitcherComponent } from './navbar-project-switcher.component';

const PROJECT_A: ProjectSummary = {
  projectUuid: 'project-a',
  name: 'Project A',
  type: 'DEFAULT',
  createdByUserUuid: null,
  createdByUserName: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  upstreamProjectUuid: null,
  expiresAt: null,
};

const PROJECT_B: ProjectSummary = {
  ...PROJECT_A,
  projectUuid: 'project-b',
  name: 'Project B',
};

describe('NavbarProjectSwitcherComponent', () => {
  let fixture: ComponentFixture<NavbarProjectSwitcherComponent>;
  let activeProject: ActiveProjectService;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavbarProjectSwitcherComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        provideTranslateService({ fallbackLang: 'en', lang: 'en' }),
        ActiveProjectService,
        { provide: Store, useValue: { dispatch: () => undefined } },
      ],
    }).compileComponents();

    TestBed.inject(TranslateService).setTranslation('en', {
      nav: { switchProject: 'Switch project: {{projectName}}' },
      settings: { projects: 'Projects' },
      projects: { current: 'Current' },
    });

    activeProject = TestBed.inject(ActiveProjectService);
    activeProject.setProjects([PROJECT_A, PROJECT_B]);
    activeProject.setActiveProject(PROJECT_A.projectUuid);

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(NavbarProjectSwitcherComponent);
    fixture.detectChanges();
  });

  it('navigates to the project explore page when another project is selected', () => {
    (
      fixture.componentInstance as unknown as {
        selectProject: (uuid: string) => void;
      }
    ).selectProject(PROJECT_B.projectUuid);

    expect(activeProject.activeProjectUuid()).toBe(PROJECT_B.projectUuid);
    expect(router.navigate).toHaveBeenCalledWith([
      '/projects',
      PROJECT_B.projectUuid,
      'explore',
    ]);
  });
});
