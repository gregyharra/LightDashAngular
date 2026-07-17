import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { OrganizationProject } from '../../../core/models/organization.model';
import { ProjectsService } from '../projects.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

const WAREHOUSE_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  trino: 'Trino',
  bigquery: 'BigQuery',
  snowflake: 'Snowflake',
  redshift: 'Redshift',
  databricks: 'Databricks',
};

@Component({
  selector: 'app-projects-page',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, ResizableSidebarDirective],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
})
export class ProjectsPageComponent {
  private readonly projectsService = inject(ProjectsService);
  private readonly appState = inject(AppStateService);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly organizationName = computed(
    () => this.appState.user()?.organizationName ?? null,
  );

  protected readonly projects = signal<OrganizationProject[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.projectsService.list().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.activeProjectService.setProjects(projects);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load projects.');
        this.loading.set(false);
      },
    });
  }

  protected warehouseLabel(type: string): string {
    return WAREHOUSE_LABELS[type] ?? type;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected openProject(projectUuid: string): void {
    this.activeProjectService.setActiveProject(projectUuid);
    void this.router.navigate(['/projects', projectUuid, 'dashboards']);
  }
}
