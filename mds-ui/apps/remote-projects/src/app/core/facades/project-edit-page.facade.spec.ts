import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { ActiveProjectService } from '@mds-ui/core';
import {
  LinkDialogSavePayload,
  ModelJoinView,
  ProjectLineage,
  ProjectRepoStatus,
  ProjectSummary,
  WarehouseListItem,
} from '@mds-ui/models';
import {
  LineageService,
  ModelJoinsService,
  ProjectDetail,
  ProjectsService,
  WarehouseService,
} from '@mds-ui/feature-projects';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { projectsFeature } from '../store/projects.reducer';
import { ProjectEditPageFacade } from './project-edit-page.facade';

describe('ProjectEditPageFacade', () => {
  const project = {
    projectUuid: 'p1',
    name: 'Demo',
  } as ProjectDetail;
  const warehouse = {
    warehouseUuid: 'w1',
    name: 'Warehouse',
  } as WarehouseListItem;
  const update = jest.fn(() => of({ ...project, name: 'Updated' }));
  const syncRepo = jest.fn(() =>
    of({ cloned: true } as ProjectRepoStatus),
  );
  const desyncRepo = jest.fn(() =>
    of({ cloned: false } as ProjectRepoStatus),
  );
  const deleteProject = jest.fn(() => of(undefined));
  const lineage = {
    nodes: [
      {
        id: 'model.orders',
        name: 'orders',
        columns: [{ name: 'customer_id', type: 'integer' }],
      },
    ],
    edges: [],
    columnEdges: [],
  } as ProjectLineage;
  const link = {
    uuid: 'link-1',
    sourceModelName: 'orders',
    sourceColumn: 'customer_id',
    targetModelName: 'customers',
    targetColumn: 'id',
  } as ModelJoinView;
  const lineageService = {
    getProjectLineage: jest.fn(() => of(lineage)),
  };
  const modelJoinsService = {
    list: jest.fn(() => of([link])),
    create: jest.fn(() => of(link)),
    update: jest.fn(() => of(link)),
    delete: jest.fn(() => of({ deleted: true })),
  };
  const activeProjects = signal<ProjectSummary[]>([]);

  beforeEach(() => {
    jest.clearAllMocks();
    activeProjects.set([]);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideStore({ [projectsFeature.name]: projectsFeature.reducer }),
        ProjectEditPageFacade,
        {
          provide: ProjectsService,
          useValue: {
            get: () => of(project),
            getRepoStatus: () => of(null),
            update,
            syncRepo,
            desyncRepo,
            delete: deleteProject,
          },
        },
        {
          provide: WarehouseService,
          useValue: { list: () => of([warehouse]) },
        },
        { provide: LineageService, useValue: lineageService },
        { provide: ModelJoinsService, useValue: modelJoinsService },
        {
          provide: TranslateService,
          useValue: { instant: (key: string) => key },
        },
        {
          provide: ActiveProjectService,
          useValue: {
            projects: activeProjects.asReadonly(),
            setProjects: (projects: ProjectSummary[]) =>
              activeProjects.set(projects),
            setActiveProject: jest.fn(),
          },
        },
      ],
    });
  });

  it('load() exposes the project and warehouses', () => {
    const facade = TestBed.inject(ProjectEditPageFacade);

    facade.load(project.projectUuid);

    expect(facade.project()).toEqual(project);
    expect(facade.warehouses()).toEqual([warehouse]);
    expect(facade.loading()).toBe(false);
  });

  it('save() writes the updated project into the store', () => {
    const facade = TestBed.inject(ProjectEditPageFacade);
    facade.load(project.projectUuid);

    facade.save(project.projectUuid, { name: 'Updated' });

    expect(update).toHaveBeenCalledWith(project.projectUuid, {
      name: 'Updated',
    });
    expect(facade.project()?.name).toBe('Updated');
    expect(facade.saving()).toBe(false);
  });

  it('owns lineage and model-link loading and save intents', () => {
    const facade = TestBed.inject(ProjectEditPageFacade);
    const payload = {
      sourceModelId: 'model.orders',
      sourceColumn: 'customer_id',
      targetModelId: 'model.customers',
      targetColumn: 'id',
    } as LinkDialogSavePayload;
    const onSaved = jest.fn();

    facade.loadLinks('p1');

    expect(facade.lineage()).toEqual(lineage);
    expect(facade.modelJoins()).toEqual([link]);
    expect(facade.modelLinkOptions()).toEqual([
      {
        id: 'model.orders',
        name: 'orders',
        columns: [{ name: 'customer_id', type: 'integer' }],
      },
    ]);
    expect(facade.linksLoading()).toBe(false);

    facade.saveLink('p1', payload, onSaved);

    expect(modelJoinsService.create).toHaveBeenCalledWith('p1', payload);
    expect(modelJoinsService.list).toHaveBeenCalledTimes(2);
    expect(facade.linksSaving()).toBe(false);
    expect(onSaved).toHaveBeenCalled();
  });

  it('owns repository synchronization state and success feedback', () => {
    const syncResult = new Subject<ProjectRepoStatus>();
    syncRepo.mockReturnValueOnce(syncResult);
    const facade = TestBed.inject(ProjectEditPageFacade);

    facade.syncRepository('p1');

    expect(facade.syncing()).toBe(true);
    expect(facade.success()).toBeNull();

    syncResult.next({ cloned: true } as ProjectRepoStatus);
    syncResult.complete();

    expect(facade.syncing()).toBe(false);
    expect(facade.repoStatus()).toEqual({ cloned: true });
    expect(facade.success()).toBe('projects.git.synced');

    facade.desyncRepository('p1');

    expect(desyncRepo).toHaveBeenCalledWith('p1');
    expect(facade.desyncing()).toBe(false);
    expect(facade.success()).toBe('projects.git.removed');
  });

  it('owns model-link delete and project delete state', () => {
    const router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
    const facade = TestBed.inject(ProjectEditPageFacade);
    facade.loadLinks('p1');
    modelJoinsService.list.mockClear();

    facade.deleteLink('p1', link);

    expect(modelJoinsService.delete).toHaveBeenCalledWith('p1', 'link-1');
    expect(modelJoinsService.list).toHaveBeenCalledWith('p1');
    expect(facade.linksSaving()).toBe(false);

    facade.deleteProject('p1');

    expect(deleteProject).toHaveBeenCalledWith('p1');
    expect(facade.deleting()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/settings/projects']);
  });
});
