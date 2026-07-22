import { NgStyle } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { SavedChartBasic } from '../../../core/models/chart.model';
import {
  Dashboard,
  DashboardConfig,
  DashboardDimensionFilter,
  DashboardTab,
  DashboardTile,
  DashboardTileTypes,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import { TimeTravelConfig } from '../../../core/models/explore.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { mockSqlCharts, MockSqlChartBasic } from '../../../core/mock/fixtures/sql-charts.fixture';
import { ChartService } from '../../charts/chart.service';
import { ExplorerService } from '../../explorer/explorer.service';
import {
  FilterableDimension,
  getFilterableDimensions,
} from '../../explorer/tables-filters-panel/tables-filters.utils';
import { DashboardService } from '../dashboard.service';
import { DashboardChartTileComponent } from '../dashboard-chart-tile/dashboard-chart-tile.component';
import { DashboardFiltersBarComponent } from '../dashboard-filters-bar/dashboard-filters-bar.component';
import { DashboardMarkdownComponent } from '../dashboard-markdown/dashboard-markdown.component';
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
import { getLoomEmbedUrl } from '../dashboard-loom.utils';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

type DraftState = {
  name: string;
  description: string;
  tabs: DashboardTab[];
  tiles: DashboardTile[];
  filters: DashboardDimensionFilter[];
  config?: DashboardConfig;
};

@Component({
  selector: 'app-dashboard-edit-page',
  imports: [
    NgStyle,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DashboardChartTileComponent,
    DashboardFiltersBarComponent,
    DashboardMarkdownComponent,
    DashboardTileGridInteractionDirective,
    DragDropModule,
    ResizableSidebarDirective,
  ],
  templateUrl: './dashboard-edit-page.component.html',
  styleUrl: './dashboard-edit-page.component.scss',
})
export class DashboardEditPageComponent {
  private readonly dashboardService = inject(DashboardService);
  private readonly chartService = inject(ChartService);
  private readonly explorerService = inject(ExplorerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly sanitizer = inject(DomSanitizer);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly dashboardUuid = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly charts = signal<SavedChartBasic[]>([]);
  protected readonly sqlCharts = signal<MockSqlChartBasic[]>(mockSqlCharts);
  protected readonly filterableDimensions = signal<FilterableDimension[]>([]);
  protected readonly draft = signal<DraftState | null>(null);
  protected readonly activeTabUuid = signal<string | null>(null);
  protected readonly selectedTileUuid = signal<string | null>(null);
  protected readonly dateZoomGranularity = signal<DateZoomGranularity>('Month');
  protected readonly timeTravel = signal<TimeTravelConfig | null>(null);
  protected readonly tabRenameDraft = signal('');

  protected readonly gridRowHeight = DASHBOARD_GRID_ROW_HEIGHT_PX;
  protected readonly gridGap = DASHBOARD_GRID_GAP_PX;
  protected readonly DashboardTileTypes = DashboardTileTypes;

  protected readonly sortedTabs = computed(() => {
    const state = this.draft();
    if (!state) {
      return [];
    }

    return [...state.tabs].sort((left, right) => left.order - right.order);
  });

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

  protected readonly selectedTile = computed(() => {
    const tileUuid = this.selectedTileUuid();
    if (!tileUuid) {
      return null;
    }

    return this.draft()?.tiles.find((tile) => tile.uuid === tileUuid) ?? null;
  });

  protected readonly dashboardFilters = computed(
    () => this.draft()?.filters ?? [],
  );

  protected readonly dashboardConfig = computed(() => this.draft()?.config);

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

  private loadDashboard(projectUuid: string, dashboardUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.dashboardService.get(projectUuid, dashboardUuid).subscribe({
      next: (dashboard) => {
        this.initDraft(dashboard);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Failed to load dashboard.'));
        this.loading.set(false);
      },
    });
  }

  private loadCharts(projectUuid: string): void {
    this.chartService.list(projectUuid).subscribe({
      next: (charts) => this.charts.set(charts),
      error: () => this.charts.set([]),
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
    this.draft.set({
      name: dashboard.name,
      description: dashboard.description ?? '',
      tabs: dashboard.tabs.map((tab) => ({ ...tab })),
      tiles: dashboard.tiles.map((tile) => ({ ...tile })) as DashboardTile[],
      filters: dashboard.filters.dimensions.map((filter) => ({ ...filter })),
      config: dashboard.config ? { ...dashboard.config } : undefined,
    });
    this.activeTabUuid.set(dashboard.tabs[0]?.uuid ?? null);
    this.selectedTileUuid.set(null);
    this.dateZoomGranularity.set(
      dashboard.config?.defaultDateZoomGranularity ?? 'Month',
    );
  }

  protected setActiveTab(tabUuid: string): void {
    this.activeTabUuid.set(tabUuid);
    this.selectedTileUuid.set(null);
  }

  protected updateDraft(partial: Partial<DraftState>): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    this.draft.set({ ...current, ...partial });
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

  protected addTab(): void {
    const current = this.draft();
    if (!current) {
      return;
    }

    const tabUuid = crypto.randomUUID();
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

  protected duplicateTab(tabUuid: string): void {
    const current = this.draft();
    const sourceTab = current?.tabs.find((tab) => tab.uuid === tabUuid);
    if (!current || !sourceTab) {
      return;
    }

    const newTabUuid = crypto.randomUUID();
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
        uuid: crypto.randomUUID(),
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
      uuid: crypto.randomUUID(),
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

  protected onFiltersChange(filters: DashboardDimensionFilter[]): void {
    this.updateDraft({ filters });
  }

  protected onDateZoomChange(granularity: DateZoomGranularity): void {
    this.dateZoomGranularity.set(granularity);

    const current = this.draft();
    if (!current) {
      return;
    }

    this.draft.set({
      ...current,
      config: {
        ...current.config,
        isDateZoomDisabled: current.config?.isDateZoomDisabled ?? false,
        defaultDateZoomGranularity: granularity,
      },
    });
  }

  protected onTimeTravelChange(timeTravel: TimeTravelConfig | null): void {
    this.timeTravel.set(timeTravel);
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

  protected cancel(): void {
    const projectUuid = this.projectUuid();
    const dashboardUuid = this.dashboardUuid();
    if (!projectUuid || !dashboardUuid) {
      return;
    }

    void this.router.navigate([
      '/projects',
      projectUuid,
      'dashboards',
      dashboardUuid,
    ]);
  }

  protected save(): void {
    const projectUuid = this.projectUuid();
    const dashboardUuid = this.dashboardUuid();
    const state = this.draft();
    const trimmedName = state?.name.trim();

    if (!projectUuid || !dashboardUuid || !state || !trimmedName || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

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
        next: () => {
          void this.router.navigate([
            '/projects',
            projectUuid,
            'dashboards',
            dashboardUuid,
          ]);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.saving.set(false);
        },
      });
  }
}
