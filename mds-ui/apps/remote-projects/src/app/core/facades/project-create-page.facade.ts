import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ActiveProjectService, apiErrorMessage } from '@mds-ui/core';
import { Warehouse, WarehouseListItem } from '@mds-ui/models';
import { ProjectCreate, ProjectsService } from '@mds-ui/feature-projects';
import { WarehouseService } from '@mds-ui/feature-warehouses';
import { ProjectsActions } from '../store/projects.actions';
import { projectsFeature } from '../store/projects.reducer';

@Injectable()
export class ProjectCreatePageFacade {
  private readonly store = inject(Store);
  private readonly projectsService = inject(ProjectsService);
  private readonly warehouseService = inject(WarehouseService);
  private readonly activeProject = inject(ActiveProjectService);
  private readonly router = inject(Router);

  readonly warehouses = this.store.selectSignal(
    projectsFeature.selectWarehouses,
  );
  readonly loading = this.store.selectSignal(projectsFeature.selectLoading);
  readonly submitting = this.store.selectSignal(projectsFeature.selectSaving);
  readonly error = this.store.selectSignal(projectsFeature.selectError);

  loadWarehouses(): void {
    this.store.dispatch(ProjectsActions.loadStarted());
    this.warehouseService.list().subscribe({
      next: (warehouses) =>
        this.store.dispatch(ProjectsActions.warehousesLoaded({ warehouses })),
      error: (error: unknown) => this.fail(error),
    });
  }

  addWarehouse(warehouse: Warehouse): void {
    const item: WarehouseListItem = warehouse;
    this.store.dispatch(
      ProjectsActions.warehousesLoaded({
        warehouses: [...this.warehouses(), item],
      }),
    );
  }

  save(payload: ProjectCreate): void {
    if (this.submitting()) {
      return;
    }
    this.store.dispatch(ProjectsActions.saveStarted());
    this.projectsService.create(payload).subscribe({
      next: (project) => {
        this.activeProject.setProjects([
          ...this.activeProject.projects(),
          project,
        ]);
        this.activeProject.setActiveProject(project.projectUuid);
        this.store.dispatch(ProjectsActions.saveSucceeded({ project }));
        void this.router.navigate([
          '/projects',
          project.projectUuid,
          'explore',
        ]);
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  cancel(): void {
    void this.router.navigate(['/settings/projects']);
  }

  private fail(error: unknown): void {
    this.store.dispatch(
      ProjectsActions.requestFailed({ message: apiErrorMessage(error) }),
    );
  }
}
