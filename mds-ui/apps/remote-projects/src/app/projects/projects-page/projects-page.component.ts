import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { map } from 'rxjs';
import { LanguageService } from '@mds-ui/core';
import { ActiveProjectService } from '@mds-ui/core';
import { AppStateService } from '@mds-ui/core';
import { ProjectSummary } from '@mds-ui/models';
import { ProjectsPageFacade } from '../../core/facades/projects-page.facade';

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
  private readonly facade = inject(ProjectsPageFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
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

  protected readonly projects = this.facade.projects;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;

  constructor() {
    this.facade.load();
  }

  protected warehouseLabel(type: string): string {
    return WAREHOUSE_LABELS[type] ?? type;
  }

  protected domainDescription(project: ProjectSummary): string {
    const description = project.description?.trim();
    if (description) {
      return description;
    }
    return this.translate.instant('projects.domainFallback');
  }

  protected formatDate(iso: string): string {
    return this.languageService.formatDate(iso, {
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
    this.facade.openProject(projectUuid);
  }

  protected openProjectEdit(projectUuid: string, event?: Event): void {
    event?.stopPropagation();
    this.facade.openProjectEdit(projectUuid);
  }

  protected createProject(): void {
    this.facade.createProject();
  }
}
