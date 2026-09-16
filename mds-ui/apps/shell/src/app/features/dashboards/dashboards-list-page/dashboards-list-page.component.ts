import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { DashboardBasicDetailsWithTileTypes } from '../../../core/models/dashboard.model';
import { DashboardService } from '../dashboard.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { ProjectBrowseNavComponent } from '../../../layout/project-browse-nav/project-browse-nav.component';
import {
  ContentListColumnHeaderComponent,
  ColumnFilterValue,
} from '../../../ui/content-list-column-header/content-list-column-header.component';
import { ContentListFilterChipsComponent } from '../../../ui/content-list-filter-chips/content-list-filter-chips.component';
import {
  DashboardColumnFilters,
  collectUniqueSpaces,
  createEmptyDashboardColumnFilters,
  emptyDateFilter,
  emptyNumberFilter,
  emptySelectFilter,
  emptyTextFilter,
  filterDashboards,
  getDashboardActiveFilterChips,
  hasActiveDashboardColumnFilters,
  isSharedSpaceFilterValue,
  parseSpaceFilterValue,
  sharedSpaceFilterValue,
  spaceFilterValue,
} from '../../../ui/content-list-filter.utils';

@Component({
  selector: 'app-dashboards-list-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    ResizableSidebarDirective,
    ProjectBrowseNavComponent,
    ContentListColumnHeaderComponent,
    ContentListFilterChipsComponent,
  ],
  templateUrl: './dashboards-list-page.component.html',
  styleUrl: './dashboards-list-page.component.scss',
})
export class DashboardsListPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly apiErrorService = inject(ApiErrorService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly dashboards = signal<DashboardBasicDetailsWithTileTypes[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly columnFilters = signal<DashboardColumnFilters>(
    createEmptyDashboardColumnFilters(),
  );

  private readonly sharedSpaceLabel = computed(() => {
    this.languageService.language();
    return this.translate.instant('dashboards.shared');
  });

  protected readonly availableSpaces = computed(() =>
    collectUniqueSpaces(this.dashboards(), (dashboard) =>
      dashboard.spaceName
        ? spaceFilterValue(dashboard.spaceName)
        : sharedSpaceFilterValue(),
    ),
  );

  protected readonly spaceOptions = computed(() =>
    this.availableSpaces().map((space) => ({
      value: space,
      label: isSharedSpaceFilterValue(space)
        ? this.sharedSpaceLabel()
        : (parseSpaceFilterValue(space) ?? space),
    })),
  );

  protected readonly filteredDashboards = computed(() =>
    filterDashboards(this.dashboards(), this.columnFilters()),
  );

  protected readonly activeFilterChips = computed(() => {
    this.languageService.language();
    return getDashboardActiveFilterChips(
      this.columnFilters(),
      {
        name: this.translate.instant('dashboards.fields.name'),
        space: this.translate.instant('dashboards.fields.space'),
        lastEdited: this.translate.instant('dashboards.fields.lastEdited'),
        views: this.translate.instant('dashboards.fields.views'),
      },
      this.spaceOptions(),
      (key, params) => this.translate.instant(key, params),
    );
  });

  protected readonly hasActiveFilters = computed(() =>
    hasActiveDashboardColumnFilters(this.columnFilters()),
  );

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadDashboards(projectUuid);
    });
  }

  private loadDashboards(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.columnFilters.set(createEmptyDashboardColumnFilters());

    this.dashboardService.list(projectUuid).subscribe({
      next: (dashboards) => {
        this.dashboards.set(dashboards);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          this.apiErrorService.showTransient(err, this.translate.instant('dashboards.loadError')),
        );
        this.loading.set(false);
      },
    });
  }

  protected updateColumnFilter(
    key: keyof DashboardColumnFilters,
    value: ColumnFilterValue,
  ): void {
    this.columnFilters.update((filters) => ({
      ...filters,
      [key]: value as DashboardColumnFilters[typeof key],
    }));
  }

  protected clearFilterChip(key: string): void {
    switch (key) {
      case 'name':
        this.updateColumnFilter('name', emptyTextFilter());
        break;
      case 'space':
        this.updateColumnFilter('space', emptySelectFilter());
        break;
      case 'lastEdited':
        this.updateColumnFilter('lastEdited', emptyDateFilter());
        break;
      case 'views':
        this.updateColumnFilter('views', emptyNumberFilter());
        break;
    }
  }

  protected clearAllFilters(): void {
    this.columnFilters.set(createEmptyDashboardColumnFilters());
  }

  protected formatDate(iso: string): string {
    return this.languageService.formatDate(iso, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected spaceName(spaceName: string | null | undefined): string {
    return spaceName || this.sharedSpaceLabel();
  }

  protected openDashboard(dashboardUuid: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate([
      '/projects',
      projectUuid,
      'dashboards',
      dashboardUuid,
    ]);
  }

  protected openCreatePage(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'dashboards', 'create']);
  }
}
