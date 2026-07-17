import { Injectable, computed, signal } from '@angular/core';
import { OrganizationProject } from '../models/organization.model';

@Injectable({ providedIn: 'root' })
export class ActiveProjectService {
  private readonly projectsSignal = signal<OrganizationProject[]>([]);
  private readonly activeUuidSignal = signal<string | null>(null);

  readonly projects = this.projectsSignal.asReadonly();
  readonly activeProjectUuid = this.activeUuidSignal.asReadonly();

  readonly activeProject = computed(() => {
    const uuid = this.activeUuidSignal();
    return this.projectsSignal().find((p) => p.projectUuid === uuid) ?? null;
  });

  setProjects(projects: OrganizationProject[]): void {
    this.projectsSignal.set(projects);

    const current = this.activeUuidSignal();
    if (!current || !projects.some((p) => p.projectUuid === current)) {
      this.activeUuidSignal.set(projects[0]?.projectUuid ?? null);
    }
  }

  setActiveProject(projectUuid: string): void {
    if (this.projectsSignal().some((p) => p.projectUuid === projectUuid)) {
      this.activeUuidSignal.set(projectUuid);
    }
  }
}
