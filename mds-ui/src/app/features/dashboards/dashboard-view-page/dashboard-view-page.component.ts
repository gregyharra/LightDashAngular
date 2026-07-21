import { NgStyle } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import {
  Dashboard,
  DashboardDimensionFilter,
  DashboardTile,
  DashboardTileTypes,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import { TimeTravelConfig } from '../../../core/models/explore.model';
import { DashboardService } from '../dashboard.service';
import { DashboardChartTileComponent } from '../dashboard-chart-tile/dashboard-chart-tile.component';
import { DashboardFiltersBarComponent } from '../dashboard-filters-bar/dashboard-filters-bar.component';
import { DashboardMarkdownComponent } from '../dashboard-markdown/dashboard-markdown.component';
import { getLoomEmbedUrl } from '../dashboard-loom.utils';
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
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DashboardChartTileComponent,
    DashboardFiltersBarComponent,
    DashboardMarkdownComponent,
    ResizableSidebarDirective,
  ],
  templateUrl: './dashboard-view-page.component.html',
  styleUrl: './dashboard-view-page.component.scss',
})
export class DashboardViewPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly activeProjectService = inject(ActiveProjectService);

  private readonly dashboardRoot = viewChild<ElementRef<HTMLElement>>('dashboardRoot');

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly dashboardUuid = signal<string | null>(null);
  protected readonly dashboard = signal<Dashboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly activeTabUuid = signal<string | null>(null);
  protected readonly dashboardFilters = signal<DashboardDimensionFilter[]>([]);
  protected readonly dateZoomGranularity = signal<DateZoomGranularity>('Month');
  protected readonly timeTravel = signal<TimeTravelConfig | null>(null);
  protected readonly refreshToken = signal(0);
  protected readonly refreshing = signal(false);
  protected readonly isFavorite = signal(false);
  protected readonly isFullscreen = signal(false);
  protected readonly showScrollTop = signal(false);

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

  protected readonly visibleTabs = computed(() =>
    (this.dashboard()?.tabs ?? [])
      .filter((tab) => !tab.hidden)
      .sort((left, right) => left.order - right.order),
  );

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

  @HostListener('window:scroll')
  protected onWindowScroll(): void {
    this.showScrollTop.set(window.scrollY > 400);
  }

  @HostListener('document:fullscreenchange')
  protected onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
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

  protected onTimeTravelChange(timeTravel: TimeTravelConfig | null): void {
    this.timeTravel.set(timeTravel);
  }

  protected refreshDashboard(): void {
    this.refreshing.set(true);
    this.refreshToken.update((value) => value + 1);

    window.setTimeout(() => {
      this.refreshing.set(false);
    }, 600);
  }

  protected toggleFavorite(): void {
    this.isFavorite.update((value) => !value);
  }

  protected toggleFullscreen(): void {
    const root = this.dashboardRoot()?.nativeElement;
    if (!root) {
      return;
    }

    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }

    void root.requestFullscreen();
  }

  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  protected loomEmbedUrl(url: string): SafeResourceUrl | null {
    const embedUrl = getLoomEmbedUrl(url);
    return embedUrl
      ? this.sanitizer.bypassSecurityTrustResourceUrl(embedUrl)
      : null;
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
