import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { OrganizationProject } from '../../../core/models/organization.model';
import { ProjectsService } from '../projects.service';

const WAREHOUSE_LABELS: Record<string, string> = {
  postgres: 'PostgreSQL',
  trino: 'Trino',
  bigquery: 'BigQuery',
  snowflake: 'Snowflake',
  redshift: 'Redshift',
  databricks: 'Databricks',
};

@Component({
  selector: 'app-project-general-tab',
  imports: [MatProgressSpinnerModule],
  templateUrl: './project-general-tab.component.html',
  styleUrl: './project-general-tab.component.scss',
})
export class ProjectGeneralTabComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);
  private readonly activeProjectService = inject(ActiveProjectService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly project = signal<OrganizationProject | null>(null);

  protected readonly projectUuid = computed(() => {
    return this.route.parent?.snapshot.paramMap.get('projectUuid') ?? null;
  });

  constructor() {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      this.error.set('Project not found.');
      this.loading.set(false);
      return;
    }

    this.activeProjectService.setActiveProject(projectUuid);

    const cached = this.activeProjectService.activeProject();
    if (cached?.projectUuid === projectUuid) {
      this.project.set(cached);
      this.loading.set(false);
      return;
    }

    this.projectsService.list().subscribe({
      next: (projects) => {
        this.activeProjectService.setProjects(projects);
        const match = projects.find((item) => item.projectUuid === projectUuid) ?? null;
        this.project.set(match);
        if (!match) {
          this.error.set('Project not found.');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load project.');
        this.loading.set(false);
      },
    });
  }

  protected warehouseLabel(type: string | undefined): string {
    if (!type) {
      return 'Not set';
    }
    return WAREHOUSE_LABELS[type] ?? type;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
