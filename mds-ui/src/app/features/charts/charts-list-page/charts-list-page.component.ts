import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { SavedChartBasic } from '../../../core/models/chart.model';
import { ChartService } from '../chart.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import {
  ContentListColumnHeaderComponent,
  ColumnFilterValue,
} from '../../../ui/content-list-column-header/content-list-column-header.component';
import { ContentListFilterChipsComponent } from '../../../ui/content-list-filter-chips/content-list-filter-chips.component';
import {
  ChartColumnFilters,
  collectUniqueSpaces,
  collectUniqueValues,
  createEmptyChartColumnFilters,
  emptyDateFilter,
  emptyNumberFilter,
  emptySelectFilter,
  emptyTextFilter,
  filterCharts,
  getChartActiveFilterChips,
  hasActiveChartColumnFilters,
} from '../../../ui/content-list-filter.utils';

const CHART_KIND_LABELS: Record<string, string> = {
  vertical_bar: 'Bar',
  horizontal_bar: 'Horizontal bar',
  line: 'Line',
  pie: 'Pie',
  table: 'Table',
};

@Component({
  selector: 'app-charts-list-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ResizableSidebarDirective,
    ContentListColumnHeaderComponent,
    ContentListFilterChipsComponent,
  ],
  templateUrl: './charts-list-page.component.html',
  styleUrl: './charts-list-page.component.scss',
})
export class ChartsListPageComponent {
  private readonly chartService = inject(ChartService);
  private readonly apiErrorService = inject(ApiErrorService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly charts = signal<SavedChartBasic[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly columnFilters = signal<ChartColumnFilters>(createEmptyChartColumnFilters());

  protected readonly availableSpaces = computed(() =>
    collectUniqueSpaces(this.charts(), (chart) => chart.spaceName),
  );

  protected readonly spaceOptions = computed(() =>
    this.availableSpaces().map((space) => ({ value: space, label: space })),
  );

  protected readonly typeOptions = computed(() =>
    collectUniqueValues(this.charts(), (chart) => chart.chartKind).map((kind) => ({
      value: kind,
      label: this.chartKindLabel(kind),
    })),
  );

  protected readonly filteredCharts = computed(() =>
    filterCharts(this.charts(), this.columnFilters()),
  );

  protected readonly activeFilterChips = computed(() =>
    getChartActiveFilterChips(this.columnFilters(), this.typeOptions()),
  );

  protected readonly hasActiveFilters = computed(() =>
    hasActiveChartColumnFilters(this.columnFilters()),
  );

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadCharts(projectUuid);
    });
  }

  private loadCharts(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.columnFilters.set(createEmptyChartColumnFilters());

    this.chartService.list(projectUuid).subscribe({
      next: (charts) => {
        this.charts.set(charts);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(this.apiErrorService.showTransient(err, 'Failed to load charts.'));
        this.loading.set(false);
      },
    });
  }

  protected updateColumnFilter(
    key: keyof ChartColumnFilters,
    value: ColumnFilterValue,
  ): void {
    this.columnFilters.update((filters) => ({
      ...filters,
      [key]: value as ChartColumnFilters[typeof key],
    }));
  }

  protected clearFilterChip(key: string): void {
    switch (key) {
      case 'name':
        this.updateColumnFilter('name', emptyTextFilter());
        break;
      case 'type':
        this.updateColumnFilter('type', emptySelectFilter());
        break;
      case 'table':
        this.updateColumnFilter('table', emptyTextFilter());
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
    this.columnFilters.set(createEmptyChartColumnFilters());
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected chartKindLabel(kind: string): string {
    return CHART_KIND_LABELS[kind] ?? kind;
  }

  protected openChart(chartUuid: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'charts', chartUuid]);
  }

  protected openCreatePage(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'charts', 'new']);
  }
}
