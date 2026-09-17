import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { ActiveProjectService } from '@mds-ui/core';
import { ProjectSummary } from '@mds-ui/models';
import { ProjectsService } from '@mds-ui/feature-projects';
import { of } from 'rxjs';
import { projectsFeature } from '../store/projects.reducer';
import { ProjectsPageFacade } from './projects-page.facade';

describe('ProjectsPageFacade', () => {
  const project = {
    projectUuid: 'p1',
    name: 'Demo',
  } as ProjectSummary;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({ [projectsFeature.name]: projectsFeature.reducer }),
        ProjectsPageFacade,
        {
          provide: ProjectsService,
          useValue: { list: () => of([project]) },
        },
      ],
    });
  });

  it('load() writes projects into the store', () => {
    const facade = TestBed.inject(ProjectsPageFacade);

    facade.load();

    expect(facade.projects()).toEqual([project]);
    expect(facade.loading()).toBe(false);
  });

  it('openProject() records the active project and navigates', () => {
    const facade = TestBed.inject(ProjectsPageFacade);
    const activeProject = TestBed.inject(ActiveProjectService);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    facade.load();
    facade.openProject(project.projectUuid);

    expect(activeProject.activeProjectUuid()).toBe(project.projectUuid);
    expect(router.navigate).toHaveBeenCalledWith([
      '/projects',
      project.projectUuid,
      'explore',
    ]);
  });
});
