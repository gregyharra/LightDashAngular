import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { ProjectSummary } from '../../../core/models/project.model';
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
  selector: 'app-projects-page',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './projects-page.component.html',
  styleUrl: './projects-page.component.scss',
})
export class ProjectsPageComponent {
  private readonly projectsService = inject(ProjectsService);
  private readonly apiErrorService = inject(ApiErrorService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  protected readonly activeProjectService = inject(ActiveProjectService);
  protected readonly appState = inject(AppStateService);

  protected readonly managementMode = toSignal(
    this.route.data.pipe(map((data) => !!data['management'])),
    { initialValue: !!this.route.snapshot.data['management'] },
  );

  protected readonly subtitleKey = computed(() =>
    this.managementMode()
      ? 'projects.managementSubtitle'
      : 'projects.exploreSubtitle',
  );

  protected readonly projects = signal<ProjectSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.projectsService.list().subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.activeProjectService.setProjects(projects);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          this.apiErrorService.showTransient(err, this.translate.instant('projects.loadError')),
        );
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

  protected openCard(projectUuid: string): void {
    if (this.managementMode()) {
      this.openProjectEdit(projectUuid);
      return;
    }
    this.openProject(projectUuid);
  }

  protected openProject(projectUuid: string): void {
    this.activeProjectService.setActiveProject(projectUuid);
    void this.router.navigate(['/projects', projectUuid, 'explore']);
  }

  protected openProjectEdit(projectUuid: string, event?: Event): void {
    event?.stopPropagation();
    this.activeProjectService.setActiveProject(projectUuid);
    void this.router.navigate(['/settings/projects', projectUuid, 'edit']);
  }

  protected createProject(): void {
    void this.router.navigate(['/settings/projects', 'create']);
  }
}
