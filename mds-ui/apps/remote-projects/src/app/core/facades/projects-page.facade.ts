import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslateService } from '@ngx-translate/core';
import { ActiveProjectService, apiErrorMessage } from '@mds-ui/core';
import { ProjectsService } from '@mds-ui/feature-projects';
import { ProjectsActions } from '../store/projects.actions';
import { projectsFeature } from '../store/projects.reducer';

@Injectable()
export class ProjectsPageFacade {
  private readonly store = inject(Store);
  private readonly projectsService = inject(ProjectsService);
  private readonly activeProject = inject(ActiveProjectService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService, { optional: true });

  readonly projects = this.store.selectSignal(projectsFeature.selectProjects);
  readonly loading = this.store.selectSignal(projectsFeature.selectLoading);
  readonly error = this.store.selectSignal(projectsFeature.selectError);

  load(): void {
    this.store.dispatch(ProjectsActions.loadStarted());
    this.projectsService.list().subscribe({
      next: (projects) => {
        this.activeProject.setProjects(projects);
        this.store.dispatch(ProjectsActions.projectsLoaded({ projects }));
      },
      error: (error: unknown) =>
        this.store.dispatch(
          ProjectsActions.requestFailed({
            message: apiErrorMessage(
              error,
              this.translate?.instant('projects.loadError') ??
                'Could not load projects',
            ),
          }),
        ),
    });
  }

  openProject(projectUuid: string): void {
    this.activeProject.setActiveProject(projectUuid);
    void this.router.navigate(['/projects', projectUuid, 'explore']);
  }

  openProjectEdit(projectUuid: string): void {
    this.activeProject.setActiveProject(projectUuid);
    void this.router.navigate(['/settings/projects', projectUuid, 'edit']);
  }

  createProject(): void {
    void this.router.navigate(['/settings/projects', 'create']);
  }
}
