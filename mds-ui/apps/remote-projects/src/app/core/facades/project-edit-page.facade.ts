import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ActiveProjectService, apiErrorMessage } from '@mds-ui/core';
import {
  LinkDialogSavePayload,
  ModelJoinView,
  ModelLinkOption,
  ProjectLineage,
  Warehouse,
} from '@mds-ui/models';
import {
  LineageService,
  ModelJoinsService,
  ProjectDetail,
  ProjectsService,
  ProjectUpdate,
} from '@mds-ui/feature-projects';
import {
  WarehouseCreateDialogFacade,
  WarehouseService,
} from '@mds-ui/feature-warehouses';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { ProjectsActions } from '../store/projects.actions';
import { projectsFeature } from '../store/projects.reducer';

@Injectable()
export class ProjectEditPageFacade {
  private readonly store = inject(Store);
  private readonly projectsService = inject(ProjectsService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly warehouseDialog = inject(WarehouseCreateDialogFacade);
  private readonly lineageService = inject(LineageService);
  private readonly modelJoinsService = inject(ModelJoinsService);
  private readonly activeProject = inject(ActiveProjectService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly project = this.store.selectSignal(projectsFeature.selectProject);
  readonly warehouses = this.store.selectSignal(
    projectsFeature.selectWarehouses,
  );
  readonly repoStatus = this.store.selectSignal(
    projectsFeature.selectRepoStatus,
  );
  readonly loading = this.store.selectSignal(projectsFeature.selectLoading);
  readonly saving = this.store.selectSignal(projectsFeature.selectSaving);
  readonly error = this.store.selectSignal(projectsFeature.selectError);
  readonly syncing = signal(false);
  readonly desyncing = signal(false);
  readonly deleting = signal(false);
  readonly success = signal<string | null>(null);
  readonly lineage = signal<ProjectLineage | null>(null);
  readonly modelJoins = signal<ModelJoinView[]>([]);
  readonly linksLoading = signal(false);
  readonly linksSaving = signal(false);
  readonly linksCount = computed(() => this.modelJoins().length);
  readonly modelLinkOptions = computed<ModelLinkOption[]>(() => {
    const lineage = this.lineage();
    if (!lineage) {
      return [];
    }
    return lineage.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      columns: (node.columns ?? []).map((column) => ({
        name: column.name,
        type: column.type,
      })),
    }));
  });

  load(projectUuid: string, onLoaded?: (project: ProjectDetail) => void): void {
    this.store.dispatch(ProjectsActions.loadStarted());
    this.activeProject.setActiveProject(projectUuid);
    forkJoin({
      project: this.projectsService.get(projectUuid),
      warehouses: this.warehouseService.list(),
    }).subscribe({
      next: ({ project, warehouses }) => {
        this.updateActiveProjects(project);
        this.store.dispatch(ProjectsActions.projectLoaded({ project }));
        this.store.dispatch(ProjectsActions.warehousesLoaded({ warehouses }));
        onLoaded?.(project);
        this.loadRepoStatus(projectUuid);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  save(
    projectUuid: string,
    payload: ProjectUpdate,
    onSaved?: (project: ProjectDetail) => void,
  ): void {
    this.store.dispatch(ProjectsActions.saveStarted());
    this.projectsService.update(projectUuid, payload).subscribe({
      next: (project) => {
        this.updateActiveProjects(project);
        this.store.dispatch(ProjectsActions.saveSucceeded({ project }));
        this.success.set(this.translate.instant('projects.edit.saved'));
        onSaved?.(project);
        this.loadRepoStatus(projectUuid);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  addWarehouse(warehouse: Warehouse): void {
    this.store.dispatch(
      ProjectsActions.warehousesLoaded({
        warehouses: [...this.warehouses(), warehouse],
      }),
    );
  }

  openCreateWarehouse(
    projectName: string,
    onCreated?: (warehouse: Warehouse) => void,
  ): void {
    this.warehouseDialog
      .open(projectName ? `${projectName} warehouse` : undefined)
      .subscribe((warehouse) => {
        if (!warehouse) {
          return;
        }
        this.addWarehouse(warehouse);
        onCreated?.(warehouse);
      });
  }

  syncRepository(projectUuid: string): void {
    if (this.syncing()) {
      return;
    }
    this.syncing.set(true);
    this.success.set(null);
    this.store.dispatch(ProjectsActions.errorCleared());
    this.projectsService.syncRepo(projectUuid).subscribe({
      next: (repoStatus) => {
        this.store.dispatch(ProjectsActions.repoStatusLoaded({ repoStatus }));
        this.syncing.set(false);
        this.success.set(this.translate.instant('projects.git.synced'));
      },
      error: (error: unknown) => {
        this.fail(error);
        this.syncing.set(false);
      },
    });
  }

  desyncRepository(projectUuid: string): void {
    if (this.desyncing()) {
      return;
    }
    this.desyncing.set(true);
    this.success.set(null);
    this.store.dispatch(ProjectsActions.errorCleared());
    this.projectsService.desyncRepo(projectUuid).subscribe({
      next: (repoStatus) => {
        this.store.dispatch(ProjectsActions.repoStatusLoaded({ repoStatus }));
        this.desyncing.set(false);
        this.success.set(this.translate.instant('projects.git.removed'));
      },
      error: (error: unknown) => {
        this.fail(error);
        this.desyncing.set(false);
      },
    });
  }

  deleteProject(projectUuid: string): void {
    if (this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.success.set(null);
    this.store.dispatch(ProjectsActions.saveStarted());
    this.projectsService.delete(projectUuid).subscribe({
      next: () => {
        this.deleting.set(false);
        this.activeProject.setProjects(
          this.activeProject
            .projects()
            .filter((item) => item.projectUuid !== projectUuid),
        );
        void this.router.navigate(['/settings/projects']);
      },
      error: (error: unknown) => {
        this.fail(error);
        this.deleting.set(false);
      },
    });
  }

  loadLinks(projectUuid: string): void {
    this.linksLoading.set(true);
    if (this.lineage()) {
      this.fetchModelJoins(projectUuid);
      return;
    }
    this.lineageService.getProjectLineage(projectUuid).subscribe({
      next: (lineage) => {
        this.lineage.set(lineage);
        this.fetchModelJoins(projectUuid);
      },
      error: () => this.linksLoading.set(false),
    });
  }

  saveLink(
    projectUuid: string,
    payload: LinkDialogSavePayload,
    onSaved?: () => void,
  ): void {
    this.linksSaving.set(true);
    const request$ = payload.uuid
      ? this.modelJoinsService.update(projectUuid, payload.uuid, payload)
      : this.modelJoinsService.create(projectUuid, payload);
    request$.subscribe({
      next: () => {
        this.linksSaving.set(false);
        this.loadLinks(projectUuid);
        onSaved?.();
      },
      error: () => this.linksSaving.set(false),
    });
  }

  deleteLink(projectUuid: string, link: ModelJoinView): void {
    if (!link.uuid || this.linksSaving()) {
      return;
    }
    this.linksSaving.set(true);
    this.modelJoinsService.delete(projectUuid, link.uuid).subscribe({
      next: () => {
        this.linksSaving.set(false);
        this.loadLinks(projectUuid);
      },
      error: () => this.linksSaving.set(false),
    });
  }

  cancel(): void {
    void this.router.navigate(['/settings/projects']);
  }

  private loadRepoStatus(projectUuid: string): void {
    this.projectsService.getRepoStatus(projectUuid).subscribe({
      next: (repoStatus) =>
        this.store.dispatch(ProjectsActions.repoStatusLoaded({ repoStatus })),
      error: () =>
        this.store.dispatch(
          ProjectsActions.repoStatusLoaded({ repoStatus: null }),
        ),
    });
  }

  private fetchModelJoins(projectUuid: string): void {
    this.modelJoinsService.list(projectUuid).subscribe({
      next: (links) => {
        this.modelJoins.set(links);
        this.linksLoading.set(false);
      },
      error: () => {
        this.modelJoins.set([]);
        this.linksLoading.set(false);
      },
    });
  }

  private updateActiveProjects(project: ProjectDetail): void {
    const current = this.activeProject.projects();
    const exists = current.some(
      (item) => item.projectUuid === project.projectUuid,
    );
    this.activeProject.setProjects(
      exists
        ? current.map((item) =>
            item.projectUuid === project.projectUuid
              ? { ...item, ...project }
              : item,
          )
        : [...current, project],
    );
  }

  private fail(error: unknown): void {
    this.store.dispatch(
      ProjectsActions.requestFailed({ message: apiErrorMessage(error) }),
    );
  }
}
