import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import {
  DashboardConfig,
  DashboardDimensionFilter,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import {
  formatDashboardFilterSummary,
  formatDateZoomLabel,
} from '../dashboard-filters';

@Component({
  selector: 'app-dashboard-filters-bar',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  templateUrl: './dashboard-filters-bar.component.html',
  styleUrl: './dashboard-filters-bar.component.scss',
})
export class DashboardFiltersBarComponent {
  readonly filters = input.required<DashboardDimensionFilter[]>();
  readonly config = input<DashboardConfig | undefined>();
  readonly dateZoomGranularity = input<DateZoomGranularity>('Month');

  readonly filtersChange = output<DashboardDimensionFilter[]>();
  readonly dateZoomChange = output<DateZoomGranularity>();

  protected readonly hidden = signal(false);

  protected readonly dateZoomOptions = computed((): DateZoomGranularity[] => {
    const config = this.config();
    return (
      config?.dateZoomGranularities ?? ['Day', 'Week', 'Month', 'Quarter', 'Year']
    );
  });

  protected readonly showDateZoom = computed(() => {
    const config = this.config();
    return config?.isDateZoomDisabled !== true;
  });

  protected readonly canAddFilter = computed(() => {
    const config = this.config();
    return config?.isAddFilterDisabled !== true;
  });

  protected readonly activeFilters = computed(() =>
    this.filters().filter((filter) => !filter.disabled),
  );

  protected formatFilterSummary(filter: DashboardDimensionFilter): string {
    return formatDashboardFilterSummary(filter);
  }

  protected formatDateZoom(granularity: DateZoomGranularity): string {
    return formatDateZoomLabel(granularity);
  }

  protected toggleHidden(): void {
    this.hidden.update((value) => !value);
  }

  protected setDateZoom(granularity: DateZoomGranularity): void {
    this.dateZoomChange.emit(granularity);
  }

  protected clearFilter(filterId: string): void {
    const updated = this.filters().map((filter) =>
      filter.id === filterId ? { ...filter, values: [] } : filter,
    );
    this.filtersChange.emit(updated);
  }
}
