import { Injectable, computed, inject, signal } from '@angular/core';
import { ProjectSummary } from '@mds-ui/models';
import { APP_DATA_INVALIDATOR } from './app-data-invalidator';

@Injectable({ providedIn: 'root' })
export class ActiveProjectService {
  private readonly dataInvalidator = inject(APP_DATA_INVALIDATOR);
  private readonly projectsSignal = signal<ProjectSummary[]>([]);
  private readonly activeUuidSignal = signal<string | null>(null);

  readonly projects = this.projectsSignal.asReadonly();
  readonly activeProjectUuid = this.activeUuidSignal.asReadonly();

  readonly activeProject = computed(() => {
    const uuid = this.activeUuidSignal();
    return this.projectsSignal().find((p) => p.projectUuid === uuid) ?? null;
  });

  setProjects(projects: ProjectSummary[]): void {
    this.projectsSignal.set(projects);

    const current = this.activeUuidSignal();
    if (!current || !projects.some((p) => p.projectUuid === current)) {
      this.activeUuidSignal.set(projects[0]?.projectUuid ?? null);
    }
  }

  setActiveProject(projectUuid: string): void {
    if (!this.projectsSignal().some((p) => p.projectUuid === projectUuid)) {
      return;
    }

    const previous = this.activeUuidSignal();
    if (previous !== null && previous !== projectUuid) {
      this.dataInvalidator.invalidateAll();
    }

    this.activeUuidSignal.set(projectUuid);
  }
}
