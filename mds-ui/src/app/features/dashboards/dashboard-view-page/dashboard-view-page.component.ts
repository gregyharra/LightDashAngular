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
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
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
import { DashboardDraftState, isDashboardDraftDirty } from '../dashboard-draft.utils';
import {
  DashboardSaveConfirmDialogComponent,
  DashboardSaveConfirmDialogData,
} from '../dashboard-save-confirm-dialog/dashboard-save-confirm-dialog.component';

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
  private readonly dialog = inject(MatDialog);
  protected readonly activeProjectService = inject(ActiveProjectService);

  private readonly dashboardRoot = viewChild<ElementRef<HTMLElement>>('dashboardRoot');

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly dashboardUuid = signal<string | null>(null);
  protected readonly dashboard = signal<Dashboard | null>(null);
  protected readonly baseline = signal<DashboardDraftState | null>(null);
  protected readonly draft = signal<DashboardDraftState | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly activeTabUuid = signal<string | null>(null);
  // Session-only — never written into draft.config, excluded from dirty detection.
  protected readonly dateZoomGranularity = signal<DateZoomGranularity>('Month');
  protected readonly timeTravel = signal<TimeTravelConfig | null>(null);
  protected readonly refreshToken = signal(0);
  protected readonly refreshing = signal(false);
  protected readonly isFavorite = signal(false);
  protected readonly isFullscreen = signal(false);
  protected readonly showScrollTop = signal(false);

  protected readonly gridRowHeight = DASHBOARD_GRID_ROW_HEIGHT_PX;
  protected readonly gridGap = DASHBOARD_GRID_GAP_PX;

  protected readonly isDirty = computed(() => {
    const baseline = this.baseline();
    const draft = this.draft();
    if (!baseline || !draft) {
      return false;
    }

    return isDashboardDraftDirty(baseline, draft);
  });

  protected readonly canSave = computed(
    () => this.isDirty() && !this.saving() && !!this.draft()?.name.trim(),
  );

  protected readonly activeTab = computed(() => {
    const state = this.draft();
    const tabUuid = this.activeTabUuid();
    if (!state) {
      return null;
    }

    return state.tabs.find((tab) => tab.uuid === tabUuid) ?? state.tabs[0] ?? null;
  });

  protected readonly visibleTiles = computed(() => {
    const state = this.draft();
    const tab = this.activeTab();
    if (!state) {
      return [];
    }

    if (!tab) {
      return state.tiles;
    }

    return state.tiles.filter((tile) => tile.tabUuid === tab.uuid);
  });

  protected readonly visibleTabs = computed(() =>
    (this.draft()?.tabs ?? [])
      .filter((tab) => !tab.hidden)
      .sort((left, right) => left.order - right.order),
  );

  protected readonly filters = computed(() => this.draft()?.filters ?? []);

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

  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.isDirty()) {
      return;
    }

    event.preventDefault();
    event.returnValue = '';
  }

  canDeactivate(): boolean {
    if (!this.isDirty()) {
      return true;
    }

    return window.confirm(
      'You have unsaved changes. Leave without saving?',
    );
  }

  private loadDashboard(projectUuid: string, dashboardUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.get(projectUuid, dashboardUuid).subscribe({
      next: (dashboard) => {
        this.dashboard.set(dashboard);
        this.initDraft(dashboard);
        this.activeTabUuid.set(dashboard.tabs[0]?.uuid ?? null);
        this.dateZoomGranularity.set(
          dashboard.config?.defaultDateZoomGranularity ?? 'Month',
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Failed to load dashboard.'));
        this.loading.set(false);
      },
    });
  }

  private initDraft(dashboard: Dashboard): void {
    const state = this.toDraftState(dashboard);
    this.baseline.set(this.cloneDraftState(state));
    this.draft.set(state);
  }

  private toDraftState(dashboard: Dashboard): DashboardDraftState {
    return {
      name: dashboard.name,
      description: dashboard.description ?? '',
      tabs: dashboard.tabs.map((tab) => ({ ...tab })),
      tiles: dashboard.tiles.map((tile) => ({ ...tile })) as DashboardTile[],
      filters: dashboard.filters.dimensions.map((filter) => ({ ...filter })),
      config: dashboard.config ? { ...dashboard.config } : undefined,
    };
  }

  private cloneDraftState(state: DashboardDraftState): DashboardDraftState {
    return {
      name: state.name,
      description: state.description,
      tabs: state.tabs.map((tab) => ({ ...tab })),
      tiles: state.tiles.map((tile) => ({ ...tile })) as DashboardTile[],
      filters: state.filters.map((filter) => ({ ...filter })),
      config: state.config ? { ...state.config } : undefined,
    };
  }

  protected setActiveTab(tabUuid: string): void {
    this.activeTabUuid.set(tabUuid);
  }

  protected onFiltersChange(filters: DashboardDimensionFilter[]): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    this.draft.set({ ...current, filters });
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

  protected openSaveConfirm(): void {
    if (!this.canSave()) {
      return;
    }

    const dialogRef = this.dialog.open<
      DashboardSaveConfirmDialogComponent,
      DashboardSaveConfirmDialogData,
      boolean
    >(DashboardSaveConfirmDialogComponent, {
      data: {
        title: 'Save changes to this dashboard?',
        body: 'This will update the dashboard for everyone with access.',
        confirmLabel: 'Save',
        cancelLabel: 'Cancel',
      },
      width: '420px',
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (confirmed) {
        this.save();
      }
    });
  }

  private save(): void {
    const projectUuid = this.projectUuid();
    const dashboardUuid = this.dashboardUuid();
    const state = this.draft();
    const trimmedName = state?.name.trim();

    if (!projectUuid || !dashboardUuid || !state || !trimmedName || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.saveError.set(null);

    this.dashboardService
      .update(projectUuid, dashboardUuid, {
        name: trimmedName,
        description: state.description.trim() || undefined,
        tabs: state.tabs,
        tiles: state.tiles,
        filters: {
          dimensions: state.filters,
          metrics: [],
          tableCalculations: [],
        },
        config: state.config,
      })
      .subscribe({
        next: (dashboard) => {
          this.dashboard.set(dashboard);
          this.baseline.set(this.cloneDraftState(state));
          this.saving.set(false);
        },
        error: (err) => {
          this.saveError.set(apiErrorMessage(err, 'Failed to save dashboard.'));
          this.saving.set(false);
        },
      });
  }
}
