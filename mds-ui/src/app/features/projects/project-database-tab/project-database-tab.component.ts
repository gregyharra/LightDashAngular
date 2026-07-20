import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ProjectWarehouseFormComponent } from '../project-warehouse-form/project-warehouse-form.component';

@Component({
  selector: 'app-project-database-tab',
  imports: [ProjectWarehouseFormComponent],
  template: `@if (projectUuid(); as uuid) {
    <app-project-warehouse-form [projectUuid]="uuid" />
  }`,
})
export class ProjectDatabaseTabComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);

  constructor() {
    const uuid = this.route.parent?.snapshot.paramMap.get('projectUuid');
    if (uuid) {
      this.projectUuid.set(uuid);
      this.activeProjectService.setActiveProject(uuid);
    }
  }
}