import { NgStyle } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
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
import { FormsModule } from '@angular/forms';
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
  DashboardTab,
  DashboardTile,
  DashboardTileTypes,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import { TimeTravelConfig } from '../../../core/models/explore.model';
import { DashboardService } from '../dashboard.service';
import { DashboardChartTileComponent } from '../dashboard-chart-tile/dashboard-chart-tile.component';
import { DashboardFiltersBarComponent } from '../dashboard-filters-bar/dashboard-filters-bar.component';
import { DashboardMarkdownComponent } from '../dashboard-markdown/dashboard-markdown.component';
import { formatDateZoomLabel } from '../dashboard-filters';
import { TimeTravelControlComponent } from '../../../shared/time-travel-control/time-travel-control.component';
import { getLoomEmbedUrl } from '../dashboard-loom.utils';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { DashboardDraftState, isDashboardDraftDirty } from '../dashboard-draft.utils';
import {
  DashboardSaveConfirmDialogComponent,
  DashboardSaveConfirmDialogData,
} from '../dashboard-save-confirm-dialog/dashboard-save-confirm-dialog.component';
import { ExplorerService } from '../../explorer/explorer.service';
import {
  FilterableDimension,
  getFilterableDimensions,
} from '../../explorer/tables-filters-panel/tables-filters.utils';
import { createUuid } from '../../../core/utils/uuid';
import { SavedChartBasic } from '../../../core/models/chart.model';
import { ChartService } from '../../charts/chart.service';
import { mockSqlCharts, MockSqlChartBasic } from '../../../core/mock/fixtures/sql-charts.fixture';
import { applyTileLayoutChange } from '../dashboard-grid-layout';
import {
  DASHBOARD_GRID_COLS,
  DASHBOARD_GRID_GAP_PX,
  DASHBOARD_GRID_ROW_HEIGHT_PX,
  DashboardTilePosition,
} from '../dashboard-grid.constants';
import {
  DashboardTileSettingsDialogComponent,
  DashboardTileSettingsDialogResult,
} from '../dashboard-tile-settings-dialog/dashboard-tile-settings-dialog.component';
import { DashboardTileGridInteractionDirective } from '../dashboard-tile-grid-interaction.directive';

@Component({
  selector: 'app-dashboard-view-page',
  imports: [
    NgStyle,
    DragDropModule,
    FormsModule,
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
    TimeTravelControlComponent,
    DashboardTileGridInteractionDirective,
  ],
  templateUrl: './dashboard-view-page.component.html',
  styleUrl: './dashboard-view-page.component.scss',
})
export class DashboardViewPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly chartService = inject(ChartService);
  private readonly explorerService = inject(ExplorerService);
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
  protected readonly selectedTileUuid = signal<string | null>(null);
  protected readonly charts = signal<SavedChartBasic[]>([]);
  protected readonly sqlCharts = signal<MockSqlChartBasic[]>(mockSqlCharts);
  // Session-only — never written into draft.config, excluded from dirty detection.
  protected readonly dateZoomGranularity = signal<DateZoomGranularity>('Month');
  protected readonly timeTravel = signal<TimeTravelConfig | null>(null);
  protected readonly refreshToken = signal(0);
  protected readonly refreshing = signal(false);
  protected readonly isFavorite = signal(false);
  protected readonly isFullscreen = signal(false);
  protected readonly showScrollTop = signal(false);
  protected readonly filterableDimensions = signal<FilterableDimension[]>([]);
  protected readonly nameEditDraft = signal('');
  protected readonly tabRenameDraft = signal('');

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

  // All tabs (including hidden), sorted — the always-edit tabs row shows
  // hidden tabs dimmed so they can be re-shown, matching the former edit page.
  protected readonly sortedTabs = computed(() =>
    [...(this.draft()?.tabs ?? [])].sort((left, right) => left.order - right.order),
  );

  protected readonly filters = computed(() => this.draft()?.filters ?? []);

  protected readonly dateZoomOptions = computed((): DateZoomGranularity[] => {
    const config = this.draft()?.config;
    return config?.dateZoomGranularities ?? ['Day', 'Week', 'Month', 'Quarter', 'Year'];
  });

  protected readonly showDateZoomControl = computed(
    () => this.draft()?.config?.isDateZoomDisabled !== true,
  );

  protected readonly DashboardTileTypes = DashboardTileTypes;
  protected readonly formatDateZoom = formatDateZoomLabel;

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
      this.loadCharts(projectUuid);
      this.loadFilterableDimensions(projectUuid);
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

  private loadFilterableDimensions(projectUuid: string): void {
    this.explorerService.listExplores(projectUuid).subscribe({
      next: (explores) => {
        const requests = explores.map((explore) =>
          this.explorerService.getExplore(projectUuid, explore.name),
        );

        if (requests.length === 0) {
          this.filterableDimensions.set([]);
          return;
        }

        let completed = 0;
        const dimensionsByFieldId = new Map<string, FilterableDimension>();

        for (const request of requests) {
          request.subscribe({
            next: (explore) => {
              for (const dimension of getFilterableDimensions(explore)) {
                dimensionsByFieldId.set(dimension.fieldId, dimension);
              }
            },
            complete: () => {
              completed += 1;
              if (completed === requests.length) {
                this.filterableDimensions.set(
                  [...dimensionsByFieldId.values()].sort((left, right) =>
                    left.label.localeCompare(right.label),
                  ),
                );
              }
            },
            error: () => {
              completed += 1;
              if (completed === requests.length) {
                this.filterableDimensions.set(
                  [...dimensionsByFieldId.values()].sort((left, right) =>
                    left.label.localeCompare(right.label),
                  ),
                );
              }
            },
          });
        }
      },
      error: () => this.filterableDimensions.set([]),
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
    this.selectedTileUuid.set(null);
  }

  protected startNameEdit(): void {
    this.nameEditDraft.set(this.draft()?.name ?? '');
  }

  protected commitNameEdit(): void {
    const name = this.nameEditDraft().trim();
    const current = this.draft();
    if (!current || !name) {
      return;
    }

    this.draft.set({ ...current, name });
  }

  protected addTab(): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    const tabUuid = createUuid();
    const tab: DashboardTab = {
      uuid: tabUuid,
      name: `Tab ${current.tabs.length + 1}`,
      order: current.tabs.length,
    };

    this.draft.set({
      ...current,
      tabs: [...current.tabs, tab],
    });
    this.activeTabUuid.set(tabUuid);
  }

  protected openTabRenameMenu(tab: DashboardTab): void {
    this.tabRenameDraft.set(tab.name);
  }

  protected saveTabRename(tabUuid: string): void {
    const name = this.tabRenameDraft().trim();
    if (!name) {
      return;
    }

    const current = this.draft();
    if (!current) {
      return;
    }

    this.draft.set({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.uuid === tabUuid ? { ...tab, name } : tab,
      ),
    });
  }

  protected duplicateTab(tabUuid: string): void {
    const current = this.draft();
    const sourceTab = current?.tabs.find((tab) => tab.uuid === tabUuid);
    if (!current || !sourceTab) {
      return;
    }

    const newTabUuid = createUuid();
    const newTab: DashboardTab = {
      uuid: newTabUuid,
      name: `${sourceTab.name} (copy)`,
      order: current.tabs.length,
      hidden: sourceTab.hidden,
    };

    const duplicatedTiles = current.tiles
      .filter((tile) => tile.tabUuid === tabUuid)
      .map((tile) => ({
        ...tile,
        uuid: createUuid(),
        tabUuid: newTabUuid,
        properties: { ...tile.properties },
      })) as DashboardTile[];

    this.draft.set({
      ...current,
      tabs: [...current.tabs, newTab],
      tiles: [...current.tiles, ...duplicatedTiles],
    });
    this.activeTabUuid.set(newTabUuid);
  }

  protected toggleTabHidden(tabUuid: string): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    this.draft.set({
      ...current,
      tabs: current.tabs.map((tab) =>
        tab.uuid === tabUuid ? { ...tab, hidden: !tab.hidden } : tab,
      ),
    });
  }

  protected deleteTab(tabUuid: string): void {
    const current = this.draft();
    if (!current || current.tabs.length <= 1) {
      return;
    }

    const tabs = current.tabs
      .filter((tab) => tab.uuid !== tabUuid)
      .map((tab, index) => ({ ...tab, order: index }));
    const tiles = current.tiles.filter((tile) => tile.tabUuid !== tabUuid);

    this.draft.set({ ...current, tabs, tiles });

    if (this.activeTabUuid() === tabUuid) {
      this.activeTabUuid.set(tabs[0]?.uuid ?? null);
    }
  }

  protected reorderTabs(event: CdkDragDrop<DashboardTab[]>): void {
    if (event.previousIndex === event.currentIndex) {
      return;
    }

    const current = this.draft();
    if (!current) {
      return;
    }

    const tabs = [...this.sortedTabs()];
    moveItemInArray(tabs, event.previousIndex, event.currentIndex);

    this.draft.set({
      ...current,
      tabs: tabs.map((tab, index) => ({ ...tab, order: index })),
    });
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


  private loadCharts(projectUuid: string): void {
    this.chartService.list(projectUuid).subscribe({
      next: (charts) => this.charts.set(charts),
      error: () => this.charts.set([]),
    });
  }

  protected addHeadingTile(): void {
    this.addTile({
      type: DashboardTileTypes.HEADING,
      w: 36,
      h: 2,
      properties: {
        text: 'New heading',
        showDivider: true,
      },
    });
  }

  protected addMarkdownTile(): void {
    this.addTile({
      type: DashboardTileTypes.MARKDOWN,
      w: 18,
      h: 6,
      properties: {
        title: 'Notes',
        content: 'Add your markdown content here.',
      },
    });
  }

  protected addLoomTile(): void {
    this.addTile({
      type: DashboardTileTypes.LOOM,
      w: 18,
      h: 9,
      properties: {
        title: 'Loom video',
        url: 'https://www.loom.com/share/example',
      },
    });
  }

  protected addSqlChartTile(savedSqlUuid: string): void {
    const chart = this.sqlCharts().find((item) => item.uuid === savedSqlUuid);
    if (!chart) {
      return;
    }

    this.addTile({
      type: DashboardTileTypes.SQL_CHART,
      w: 18,
      h: 9,
      properties: {
        title: chart.name,
        savedSqlUuid: chart.uuid,
        chartName: chart.name,
      },
    });
  }

  protected addChartTile(chartUuid: string): void {
    const chart = this.charts().find((item) => item.uuid === chartUuid);
    if (!chart) {
      return;
    }

    this.addTile({
      type: DashboardTileTypes.SAVED_CHART,
      w: 18,
      h: 9,
      properties: {
        title: chart.name,
        savedChartUuid: chart.uuid,
        chartName: chart.name,
        lastVersionChartKind: chart.chartKind,
      },
    });
  }

  private addTile(
    config: Pick<DashboardTile, 'type' | 'w' | 'h' | 'properties'>,
  ): void {
    const current = this.draft();
    const tab = this.activeTab();
    if (!current || !tab) {
      return;
    }

    const tabTiles = current.tiles.filter((tile) => tile.tabUuid === tab.uuid);
    const nextY = tabTiles.reduce((max, tile) => Math.max(max, tile.y + tile.h), 0);

    const tile: DashboardTile = {
      uuid: createUuid(),
      type: config.type,
      x: 0,
      y: nextY,
      w: config.w,
      h: config.h,
      tabUuid: tab.uuid,
      properties: config.properties,
    } as DashboardTile;

    this.draft.set({
      ...current,
      tiles: [...current.tiles, tile],
    });
    this.selectedTileUuid.set(tile.uuid);
  }

  protected removeTile(tileUuid: string): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    this.draft.set({
      ...current,
      tiles: current.tiles.filter((tile) => tile.uuid !== tileUuid),
    });

    if (this.selectedTileUuid() === tileUuid) {
      this.selectedTileUuid.set(null);
    }
  }

  protected selectTile(tileUuid: string): void {
    this.selectedTileUuid.set(tileUuid);
  }

  protected openTileSettings(tile: DashboardTile): void {
    this.selectTile(tile.uuid);

    const dialogRef = this.dialog.open<
      DashboardTileSettingsDialogComponent,
      { tile: DashboardTile; tabs?: DashboardTab[] },
      DashboardTileSettingsDialogResult
    >(DashboardTileSettingsDialogComponent, {
      data: { tile, tabs: this.draft()?.tabs },
      width: '480px',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result?.tile) {
        return;
      }

      this.applyTileUpdate(result.tile, result.moveToTabUuid);
    });
  }

  private applyTileUpdate(updatedTile: DashboardTile, moveToTabUuid?: string): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    let nextTile = updatedTile;
    if (moveToTabUuid && moveToTabUuid !== updatedTile.tabUuid) {
      const tabTiles = current.tiles.filter((tile) => tile.tabUuid === moveToTabUuid);
      const nextY = tabTiles.reduce((max, tile) => Math.max(max, tile.y + tile.h), 0);
      nextTile = {
        ...updatedTile,
        tabUuid: moveToTabUuid,
        x: 0,
        y: nextY,
      };
    }

    this.draft.set({
      ...current,
      tiles: current.tiles.map((tile) =>
        tile.uuid === nextTile.uuid ? nextTile : tile,
      ),
    });
  }

  protected updateTilePosition(
    tileUuid: string,
    position: Partial<DashboardTilePosition>,
  ): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    const targetTile = current.tiles.find((tile) => tile.uuid === tileUuid);
    if (!targetTile) {
      return;
    }

    const tabUuid = targetTile.tabUuid;
    const tabTileIds = new Set(
      current.tiles
        .filter((tile) => tile.tabUuid === tabUuid)
        .map((tile) => tile.uuid),
    );

    const layoutItems = current.tiles
      .filter((tile) => tabTileIds.has(tile.uuid))
      .map((tile) => ({
        id: tile.uuid,
        x: tile.x,
        y: tile.y,
        w: tile.w,
        h: tile.h,
      }));

    const updatedLayout = applyTileLayoutChange(
      layoutItems,
      tileUuid,
      position,
    );
    const positionById = new Map(
      updatedLayout.map((item) => [item.id, item]),
    );

    this.draft.set({
      ...current,
      tiles: current.tiles.map((tile) => {
        if (!tabTileIds.has(tile.uuid)) {
          return tile;
        }

        const next = positionById.get(tile.uuid);
        if (!next) {
          return tile;
        }

        return {
          ...tile,
          x: next.x,
          y: next.y,
          w: next.w,
          h: next.h,
        };
      }),
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
