import { NgStyle } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import {
  Dashboard,
  DashboardTile,
  DashboardTileTypes,
} from '../../../core/models/dashboard.model';
import { DashboardService } from '../dashboard.service';
import { DashboardChartTileComponent } from '../dashboard-chart-tile/dashboard-chart-tile.component';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

const GRID_COLS = 36;
const GRID_ROW_HEIGHT_PX = 55;
const GRID_GAP_PX = 10;

@Component({
  selector: 'app-dashboard-view-page',
  imports: [
    NgStyle,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    DashboardChartTileComponent,
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

  protected readonly gridRowHeight = GRID_ROW_HEIGHT_PX;
  protected readonly gridGap = GRID_GAP_PX;

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

  protected tileGridStyle(tile: DashboardTile): Record<string, string | number> {
    return {
      '--tile-x': tile.x,
      '--tile-y': tile.y,
      '--tile-w': tile.w,
      '--tile-h': tile.h,
      '--grid-cols': GRID_COLS,
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
