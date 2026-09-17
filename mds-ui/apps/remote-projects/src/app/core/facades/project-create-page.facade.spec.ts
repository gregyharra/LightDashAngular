import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { ActiveProjectService } from '@mds-ui/core';
import { ProjectSummary, WarehouseListItem } from '@mds-ui/models';
import {
  ProjectsService,
} from '@mds-ui/feature-projects';
import { WarehouseService } from '@mds-ui/feature-projects';
import { of } from 'rxjs';
import { projectsFeature } from '../store/projects.reducer';
import { ProjectCreatePageFacade } from './project-create-page.facade';

describe('ProjectCreatePageFacade', () => {
  const warehouse = {
    warehouseUuid: 'w1',
    name: 'Warehouse',
  } as WarehouseListItem;
  const project = {
    projectUuid: 'p1',
    name: 'Demo',
  } as ProjectSummary;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({ [projectsFeature.name]: projectsFeature.reducer }),
        ProjectCreatePageFacade,
        {
          provide: ProjectsService,
          useValue: { create: jest.fn(() => of(project)) },
        },
        {
          provide: WarehouseService,
          useValue: { list: () => of([warehouse]) },
        },
      ],
    });
  });

  it('loadWarehouses() exposes available warehouses', () => {
    const facade = TestBed.inject(ProjectCreatePageFacade);

    facade.loadWarehouses();

    expect(facade.warehouses()).toEqual([warehouse]);
    expect(facade.loading()).toBe(false);
  });

  it('save() updates active projects and navigates to explore', () => {
    const facade = TestBed.inject(ProjectCreatePageFacade);
    const activeProject = TestBed.inject(ActiveProjectService);
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);

    facade.save({ name: 'Demo' });

    expect(activeProject.projects()).toEqual([project]);
    expect(activeProject.activeProjectUuid()).toBe(project.projectUuid);
    expect(router.navigate).toHaveBeenCalledWith([
      '/projects',
      project.projectUuid,
      'explore',
    ]);
  });
});
