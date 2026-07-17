import { NgStyle } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import {
  Dashboard,
  DashboardDimensionFilter,
  DashboardTile,
  DashboardTileTypes,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import { DashboardService } from '../dashboard.service';
import { DashboardChartTileComponent } from '../dashboard-chart-tile/dashboard-chart-tile.component';
import { DashboardFiltersBarComponent } from '../dashboard-filters-bar/dashboard-filters-bar.component';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

import {
  DASHBOARD_GRID_COLS,
  DASHBOARD_GRID_GAP_PX,
  DASHBOARD_GRID_ROW_HEIGHT_PX,
} from '../dashboard-grid.constants';

@Component({
  selector: 'app-dashboard-view-page',
  imports: [
    NgStyle,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DashboardChartTileComponent,
    DashboardFiltersBarComponent,
    ResizableSidebarDirective,
  ],
  templateUrl: './dashboard-view-page.component.html',
  styleUrl: './dashboard-view-page.component.scss',
})
export class DashboardViewPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly dashboardUuid = signal<string | null>(null);
  protected readonly dashboard = signal<Dashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activeTabUuid = signal<string | null>(null);
  protected readonly dashboardFilters = signal<DashboardDimensionFilter[]>([]);
  protected readonly dateZoomGranularity = signal<DateZoomGranularity>('Month');

  protected readonly gridRowHeight = DASHBOARD_GRID_ROW_HEIGHT_PX;
  protected readonly gridGap = DASHBOARD_GRID_GAP_PX;

  protected readonly activeTab = computed(() => {
    const dash = this.dashboard();
    const tabUuid = this.activeTabUuid();
    if (!dash) {
      return null;
    }

    return dash.tabs.find((tab) => tab.uuid === tabUuid) ?? dash.tabs[0] ?? null;
  });

  protected readonly visibleTiles = computed(() => {
    const dash = this.dashboard();
    const tab = this.activeTab();
    if (!dash) {
      return [];
    }

    if (!tab) {
      return dash.tiles;
    }

    return dash.tiles.filter((tile) => tile.tabUuid === tab.uuid);
  });

  protected readonly DashboardTileTypes = DashboardTileTypes;

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const dashboardUuid = params.get('dashboardUuid');

      if (!projectUuid || !dashboardUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.dashboardUuid.set(dashboardUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadDashboard(projectUuid, dashboardUuid);
    });
  }

  private loadDashboard(projectUuid: string, dashboardUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.get(projectUuid, dashboardUuid).subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.activeTabUuid.set(dashboard.tabs[0]?.uuid ?? null);
        this.dashboardFilters.set(dashboard.filters.dimensions);
        this.dateZoomGranularity.set(
          dashboard.config?.defaultDateZoomGranularity ?? 'Month',
        );
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load dashboard.');
        this.loading.set(false);
      },
    });
  }

  protected setActiveTab(tabUuid: string): void {
    this.activeTabUuid.set(tabUuid);
  }

  protected onFiltersChange(filters: DashboardDimensionFilter[]): void {
    this.dashboardFilters.set(filters);
  }

  protected onDateZoomChange(granularity: DateZoomGranularity): void {
    this.dateZoomGranularity.set(granularity);
  }

  protected tileGridStyle(tile: DashboardTile): Record<string, string | number> {
    return {
      '--tile-x': tile.x,
      '--tile-y': tile.y,
      '--tile-w': tile.w,
      '--tile-h': tile.h,
      '--grid-cols': DASHBOARD_GRID_COLS,
    };
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

}
