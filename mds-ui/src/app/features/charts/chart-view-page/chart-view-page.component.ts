import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  PLATFORM_ID,
  Renderer2,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { DashboardDimensionFilter } from '../../../core/models/dashboard.model';
import {
  ChartConfig,
  ChartDisplayConfig,
  ChartKind,
  SavedChart,
  defaultConfigForType,
  normalizeChartConfig,
} from '../../../core/models/chart.model';
import {
  applyChartKindChange,
  applyChartPanelPatch,
  chartKindFromConfig,
  ChartConfigCache,
  toChartPanelView,
} from '../../../core/models/chart-config.utils';
import {
  AdditionalMetric,
  Explore,
  ExploreSummary,
  FieldId,
  MetricQuery,
  MetricQueryFilter,
  QueryResults,
  TimeTravelConfig,
  getFieldId,
} from '../../../core/models/explore.model';
import { DbtTreeNode, LineageNode } from '../../../core/models/lineage.model';
import { ChartService } from '../chart.service';
import {
  ChartDetailsDialogComponent,
  ChartDetailsDialogData,
  ChartDetailsDialogResult,
} from '../chart-details-dialog/chart-details-dialog.component';
import {
  SaveChartDialogComponent,
  SaveChartDialogData,
  SaveChartDialogResult,
} from '../save-chart-dialog/save-chart-dialog.component';
import { ExplorerService } from '../../explorer/explorer.service';
import {
  CreateChartFromExploreState,
  readCreateFromExploreState,
} from '../../explorer/create-chart-from-explore';
import { LineageService } from '../../lineage/lineage.service';
import { FolderSearchPanelComponent } from '../../lineage/folder-search-panel/folder-search-panel.component';
import { findTreeNodeByLineageId } from '../../lineage/dbt-tree-utils';
import {
  findExploreByName,
  findExploreForLineageNode,
} from '../../explorer/explore-lineage.utils';
import {
  exploreHasFields,
  isExploreableDbtTreeNode,
  resolveExploreNameForSelection,
} from '../../explorer/explore-from-dbt.utils';
import {
  clampQueryLimit,
  resolveCsvMaxLimit,
  resolveMaxQueryLimit,
} from '../../explorer/query-limit.utils';
import { ChartVisualizationComponent } from '../chart-visualization/chart-visualization.component';
import { QueryResultsPanelComponent } from '../query-results-panel/query-results-panel.component';
import { ExportFormat } from '../../export/export.models';
import { ExportService } from '../../export/export.service';
import { startExport } from '../../export/start-export';
import { chartExportPlacement } from './chart-export-placement';
import { resolveChartDraftName } from './chart-draft-name';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { ProjectBrowseNavComponent } from '../../../layout/project-browse-nav/project-browse-nav.component';
import { AppStateService } from '../../../core/services/app-state.service';
import { SqlHighlightComponent } from '../../../shared/sql-highlight/sql-highlight.component';
import { RunQueryButtonComponent } from '../../../shared/run-query-button/run-query-button.component';
import { ChartFieldsAccordionComponent } from '../../../shared/chart-fields-accordion/chart-fields-accordion.component';
import { TablesChartConfigPanelComponent } from '../../explorer/tables-chart-config-panel/tables-chart-config-panel.component';
import { TablesChartDisplayConfig } from '../../explorer/tables-chart-config-panel/tables-chart-config.constants';
import { TablesFiltersPanelComponent } from '../../explorer/tables-filters-panel/tables-filters-panel.component';
import { getFilterableDimensions } from '../../explorer/tables-filters-panel/tables-filters.utils';
import { buildMetricQuerySql } from '../../explorer/metric-query-sql.utils';
import {
  enrichDashboardFilterLabels,
  extractDashboardFiltersFromMetricQuery,
  mergeDashboardFiltersIntoMetricQuery,
} from '../../dashboards/dashboard-filters';
import {
  ChartQueryActions,
  ChartQueryEntry,
  ChartQueryKeyInput,
  chartQueryKey,
  selectEntries,
} from '../../../core/store';
import { combineLatest, forkJoin } from 'rxjs';
import {
  LdButtonComponent,
  LdIconButtonComponent,
  LdPageFrameComponent,
} from '../../../design-system';

type TableFieldGroup = {
  trackKey: string;
  table: { name: string; label: string };
  dimensions: { fieldId: FieldId; label: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

const CONFIG_COLLAPSED_STORAGE_KEY = 'lightdash-chart-view-config-collapsed';
const CONFIG_WIDTH_STORAGE_KEY = 'lightdash-chart-view-config-width';
const CONFIG_DEFAULT_WIDTH = 300;
const CONFIG_MIN_WIDTH = 240;
const CONFIG_MAX_WIDTH = 480;
const CONFIG_COLLAPSED_WIDTH = 44;
const RESULTS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const RESULTS_DEFAULT_PAGE_SIZE = 25;

@Component({
  selector: 'app-chart-view-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatMenuModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
    ChartVisualizationComponent,
    QueryResultsPanelComponent,
    FolderSearchPanelComponent,
    TablesChartConfigPanelComponent,
    TablesFiltersPanelComponent,
    ResizableSidebarDirective,
    ProjectBrowseNavComponent,
    RunQueryButtonComponent,
    ChartFieldsAccordionComponent,
    SqlHighlightComponent,
    LdButtonComponent,
    LdIconButtonComponent,
    LdPageFrameComponent,
  ],
  templateUrl: './chart-view-page.component.html',
  styleUrl: './chart-view-page.component.scss',
})
export class ChartViewPageComponent {
  private readonly chartService = inject(ChartService);
  private readonly explorerService = inject(ExplorerService);
  private readonly lineageService = inject(LineageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appState = inject(AppStateService);
  private readonly dialog = inject(MatDialog);
  private readonly exportService = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly language = inject(LanguageService);
  private readonly translate = inject(TranslateService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);
  private readonly store = inject(Store);
  private readonly activeProjectService = inject(ActiveProjectService);
  protected readonly chartExportPlacement = chartExportPlacement;

  private readonly cacheEntries = toSignal(this.store.select(selectEntries), {
    initialValue: {} as Record<string, ChartQueryEntry>,
  });

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly chartUuid = signal<string | null>(null);
  protected readonly chart = signal<SavedChart | null>(null);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly dbtTree = signal<DbtTreeNode[]>([]);
  protected readonly lineageNodes = signal<LineageNode[]>([]);
  protected readonly explores = signal<ExploreSummary[]>([]);
  protected readonly selectedTableId = signal<string | null>(null);
  protected readonly projectTreeLoading = signal(false);
  protected readonly projectTreeError = signal<string | null>(null);

  protected readonly resultsPageSizeOptions = RESULTS_PAGE_SIZE_OPTIONS;
  protected readonly resultsPageIndex = signal(0);
  protected readonly resultsPageSize = signal(RESULTS_DEFAULT_PAGE_SIZE);

  protected readonly chartConfig = signal<ChartConfig>(
    defaultConfigForType('cartesian'),
  );
  protected readonly cachedChartConfigs = signal<ChartConfigCache>({});
  protected readonly panelView = computed(() =>
    toChartPanelView(this.chartConfig()),
  );
  protected readonly chartKind = computed(() => this.panelView().chartKind);
  protected readonly chartXField = computed(() => this.panelView().xField);
  protected readonly chartYFields = computed(() => this.panelView().yFields);
  protected readonly funnelDataInput = computed(
    () => this.panelView().funnelDataInput ?? 'column',
  );
  protected readonly treemapDimensionFieldIds = computed(
    () => this.panelView().treemapDimensionFieldIds ?? [],
  );
  protected readonly gaugeMin = computed(() => this.panelView().gaugeMin);
  protected readonly gaugeMax = computed(() => this.panelView().gaugeMax);
  protected readonly showGaugeLabel = computed(
    () => this.panelView().showGaugeLabel ?? true,
  );
  protected readonly sankeySourceFieldId = computed(
    () => this.panelView().sankeySourceFieldId ?? null,
  );
  protected readonly sankeyTargetFieldId = computed(
    () => this.panelView().sankeyTargetFieldId ?? null,
  );
  protected readonly sankeyWeightFieldId = computed(
    () => this.panelView().sankeyWeightFieldId ?? null,
  );
  protected readonly showNodeLabels = computed(
    () => this.panelView().showNodeLabels ?? true,
  );
  protected readonly chartDisplayConfig = computed(
    () => this.panelView().displayConfig as TablesChartDisplayConfig,
  );
  protected readonly selectedDimensions = signal<Set<FieldId>>(new Set());
  protected readonly selectedMetrics = signal<Set<FieldId>>(new Set());
  protected readonly fieldSearch = signal('');
  protected readonly additionalMetrics = signal<AdditionalMetric[]>([]);
  protected readonly dimensionFilters = signal<DashboardDimensionFilter[]>([]);
  private readonly metricQueryFilters = signal<MetricQueryFilter>({});
  private readonly timeTravel = signal<TimeTravelConfig | null>(null);
  private pendingCreateFromExplore: CreateChartFromExploreState | null = null;
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly saveLoading = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveSuccess = signal(false);

  protected readonly isCreateMode = signal(false);
  protected readonly editMode = signal(false);
  protected readonly configureMode = signal(false);
  protected readonly draftName = signal('');
  private readonly draftNameEdited = signal(false);
  protected readonly draftDescription = signal('');
  private readonly translatedUntitledName = computed(() => {
    this.language.language();
    return this.translate.instant('charts.workspace.untitled');
  });
  private readonly effectiveDraftName = computed(() =>
    resolveChartDraftName(
      this.draftName(),
      !this.isCreateMode() || this.draftNameEdited(),
      this.translatedUntitledName(),
    ),
  );

  protected readonly maxQueryLimit = computed(() =>
    resolveMaxQueryLimit(this.appState.health()?.query?.maxLimit),
  );

  protected readonly queryRowLimit = computed(() =>
    clampQueryLimit(this.chartDisplayConfig().rowLimit, this.maxQueryLimit()),
  );

  protected readonly canRunQuery = computed(
    () =>
      this.selectedDimensionList().length > 0 ||
      this.selectedMetricList().length > 0,
  );

  protected readonly displayName = computed(() => {
    if (this.editMode()) {
      return (
        this.effectiveDraftName().trim() ||
        this.chart()?.name ||
        this.translate.instant('charts.workspace.untitled')
      );
    }
    return this.chart()?.name ?? '';
  });

  protected readonly displayDescription = computed(() => {
    if (this.editMode()) {
      return this.draftDescription();
    }
    return this.chart()?.description ?? '';
  });

  protected readonly compiledSql = computed(
    () => this.queryResults()?.compiledSql?.trim() || null,
  );

  protected readonly generatedSql = computed(() => {
    const explore = this.explore();
    if (!explore) {
      return null;
    }
    return buildMetricQuerySql(
      explore,
      this.selectedDimensionList(),
      this.selectedMetricList(),
      clampQueryLimit(this.chartDisplayConfig().rowLimit, this.maxQueryLimit()),
      this.dimensionFilters(),
    );
  });

  protected readonly displaySql = computed(
    () => this.compiledSql() ?? this.generatedSql(),
  );

  protected readonly configCollapsed = signal(false);
  protected readonly configPanelWidth = signal(CONFIG_DEFAULT_WIDTH);
  protected readonly configResizing = signal(false);
  protected readonly configCollapsedWidth = CONFIG_COLLAPSED_WIDTH;

  private configIsDragging = false;
  private configStartX = 0;
  private configStartWidth = 0;
  private configUnlistenMove?: () => void;
  private configUnlistenUp?: () => void;

  protected readonly tableGroups = computed<TableFieldGroup[]>(() => {
    const explore = this.explore();
    if (!explore) {
      return [];
    }

    return Object.values(explore.tables).map((table) => ({
      trackKey: `table:${table.name}`,
      table: { name: table.name, label: table.label },
      dimensions: Object.values(table.dimensions)
        .filter((dim) => !dim.hidden)
        .map((dim) => ({
          fieldId: getFieldId(table.name, dim.name),
          label: dim.label,
        })),
      metrics: Object.values(table.metrics)
        .filter((metric) => !metric.hidden)
        .map((metric) => ({
          fieldId: getFieldId(table.name, metric.name),
          label: metric.label,
        })),
    }));
  });

  protected readonly filteredTableGroups = computed(() => {
    const query = this.fieldSearch().trim().toLowerCase();
    const groups = this.tableGroups();

    if (!query) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        dimensions: group.dimensions.filter((field) =>
          field.label.toLowerCase().includes(query),
        ),
        metrics: group.metrics.filter((field) =>
          field.label.toLowerCase().includes(query),
        ),
      }))
      .filter(
        (group) => group.dimensions.length > 0 || group.metrics.length > 0,
      );
  });

  protected readonly selectedFieldIds = computed(() => {
    const ids = new Set<FieldId>(this.selectedDimensions());
    for (const fieldId of this.selectedMetrics()) {
      ids.add(fieldId);
    }
    return ids;
  });

  protected readonly selectedDimensionList = computed(() =>
    Array.from(this.selectedDimensions()),
  );

  protected readonly selectedMetricList = computed(() =>
    Array.from(this.selectedMetrics()),
  );

  protected readonly filterableDimensions = computed(() => {
    const explore = this.explore();
    if (!explore) {
      return [];
    }
    return getFilterableDimensions(explore);
  });

  protected readonly displayedColumns = computed(() => {
    const results = this.queryResults();
    if (!results) {
      return [];
    }
    return Object.keys(results.fields);
  });

  protected readonly resultRows = computed(() => {
    const results = this.queryResults();
    if (!results) {
      return [];
    }

    return results.rows.map((row) => {
      const flat: Record<string, string> = {};
      for (const [fieldId, cell] of Object.entries(row)) {
        flat[fieldId] = cell.value.formatted;
      }
      return flat;
    });
  });

  protected readonly pagedResultRows = computed(() => {
    const rows = this.resultRows();
    const pageSize = this.resultsPageSize();
    const pageIndex = this.clampedResultsPageIndex();
    const start = pageIndex * pageSize;
    return rows.slice(start, start + pageSize);
  });

  protected readonly clampedResultsPageIndex = computed(() => {
    const rows = this.resultRows();
    const pageSize = this.resultsPageSize();
    const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
    return Math.min(this.resultsPageIndex(), maxPage);
  });

  protected readonly displayTableLabel = computed(() => {
    const explore = this.explore();
    if (explore) {
      return explore.label || explore.name;
    }
    return this.chart()?.tableName ?? '';
  });

  protected readonly canRenderChart = computed(() => {
    const results = this.queryResults();
    if (!results || results.rows.length === 0) {
      return false;
    }

    const kind = this.chartKind();
    if (kind === 'table') {
      return true;
    }

    if (kind === 'big_number' || kind === 'gauge') {
      return this.chartYFields().length > 0;
    }

    if (kind === 'funnel') {
      return !!this.chartXField();
    }

    if (kind === 'treemap') {
      return (
        this.chartYFields().length > 0 &&
        this.treemapDimensionFieldIds().length > 0
      );
    }

    if (kind === 'sankey') {
      return !!(
        this.sankeySourceFieldId() &&
        this.sankeyTargetFieldId() &&
        this.sankeyWeightFieldId()
      );
    }

    return !!(this.chartXField() && this.chartYFields().length > 0);
  });

  protected readonly canSave = computed(
    () =>
      (this.isCreateMode() || !!this.chart()) &&
      !!this.explore() &&
      this.editMode() &&
      (this.isCreateMode() || this.effectiveDraftName().trim().length > 0) &&
      this.canRenderChart() &&
      !this.queryLoading() &&
      !this.queryError() &&
      !this.saveLoading(),
  );

  protected readonly getFieldLabelFn = (fieldId: FieldId): string =>
    this.getFieldLabel(fieldId);

  constructor() {
    this.configCollapsed.set(this.readConfigCollapsedState());
    if (isPlatformBrowser(this.platformId)) {
      this.configPanelWidth.set(this.readConfigSavedWidth());
    }

    this.destroyRef.onDestroy(() => {
      this.stopConfigResize();
    });

    this.pendingCreateFromExplore = readCreateFromExploreState(this.router);

    combineLatest([this.route.data, this.route.paramMap]).subscribe(
      ([data, params]) => {
        const createMode = !!data['createMode'];
        this.isCreateMode.set(createMode);

        const projectUuid = params.get('projectUuid');
        if (!projectUuid) {
          return;
        }

        if (createMode) {
          this.initCreateMode(projectUuid);
          return;
        }

        const chartUuid = params.get('chartUuid');
        if (!chartUuid) {
          return;
        }

        this.projectUuid.set(projectUuid);
        this.chartUuid.set(chartUuid);
        this.activeProjectService.setActiveProject(projectUuid);
        this.editMode.set(false);
        this.configureMode.set(false);
        this.loadChart(projectUuid, chartUuid);
      },
    );

    effect(() => {
      const input = this.queryCacheInput();
      if (!input) {
        return;
      }

      const entry = this.cacheEntries()[chartQueryKey(input)];
      if (!entry) {
        return;
      }

      if (entry.snapshot?.queryResults) {
        this.queryResults.set(entry.snapshot.queryResults);
        if (entry.snapshot.chartConfig) {
          this.chartConfig.set(entry.snapshot.chartConfig);
        }
        this.resultsPageIndex.set(0);
      }

      if (entry.status === 'loading') {
        this.queryLoading.set(!entry.snapshot?.queryResults);
        this.queryError.set(null);
      } else if (entry.status === 'success') {
        this.queryLoading.set(false);
        this.queryError.set(null);
      } else if (entry.status === 'error') {
        this.queryLoading.set(false);
        this.queryError.set(
          entry.error ?? this.translate.instant('common.queryFailed'),
        );
      }
    });
  }

  protected enterEditMode(): void {
    const chart = this.chart();
    if (!chart) {
      return;
    }
    this.draftName.set(chart.name);
    this.draftNameEdited.set(true);
    this.draftDescription.set(chart.description ?? '');
    this.editMode.set(true);
    this.configureMode.set(false);
    this.configCollapsed.set(false);
    this.ensureProjectTreeLoaded();
  }

  protected exitEditMode(): void {
    this.editMode.set(false);
    this.configureMode.set(false);
    this.saveSuccess.set(false);
    this.saveError.set(null);
  }

  protected onDoneClick(): void {
    if (this.isCreateMode()) {
      this.cancelCreate();
      return;
    }
    this.exitEditMode();
  }

  protected cancelCreate(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }
    void this.router.navigate(['/projects', projectUuid, 'charts']);
  }

  protected toggleConfigureMode(event?: Event): void {
    event?.stopPropagation();
    if (!this.editMode()) {
      return;
    }
    const next = !this.configureMode();
    this.configureMode.set(next);
    if (next) {
      this.configCollapsed.set(false);
    }
  }

  protected closeConfigureMode(): void {
    this.configureMode.set(false);
  }

  protected openChartDetailsDialog(): void {
    if (!this.editMode()) {
      return;
    }

    const dialogRef = this.dialog.open<
      ChartDetailsDialogComponent,
      ChartDetailsDialogData,
      ChartDetailsDialogResult
    >(ChartDetailsDialogComponent, {
      data: {
        name: this.effectiveDraftName(),
        description: this.draftDescription(),
      },
      width: '28rem',
      maxWidth: '90vw',
      panelClass: 'chart-details-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.draftName.set(result.name);
      this.draftNameEdited.set(true);
      this.draftDescription.set(result.description);
    });
  }

  protected onDimensionFiltersChange(filters: DashboardDimensionFilter[]): void {
    this.dimensionFilters.set(filters);
  }

  protected getColumnLabel(column: FieldId): string {
    const results = this.queryResults();
    return results?.fields[column]?.label ?? this.getFieldLabel(column);
  }

  protected readonly columnLabelFn = (column: string): string =>
    this.getColumnLabel(column);

  protected readonly isMetricFn = (column: string): boolean =>
    this.isResultColumnMetric(column);

  protected isResultColumnMetric(column: FieldId): boolean {
    const results = this.queryResults();
    if (!results) {
      return false;
    }
    const field = results.fields[column];
    if (field?.fieldType === 'metric') {
      return true;
    }
    if (field?.fieldType === 'dimension') {
      return false;
    }
    return results.metricQuery.metrics.includes(column);
  }

  protected onResultsPage(event: PageEvent): void {
    this.resultsPageIndex.set(event.pageIndex);
    this.resultsPageSize.set(event.pageSize);
  }

  protected onExportCsv(): void {
    this.startChartExport('csv');
  }

  protected onExportXlsx(): void {
    this.startChartExport('xlsx');
  }

  private startChartExport(format: ExportFormat): void {
    const projectUuid = this.projectUuid();
    const metricQuery = this.queryResults()?.metricQuery;
    if (!projectUuid || !metricQuery) {
      return;
    }

    startExport({
      dialog: this.dialog,
      exportService: this.exportService,
      snackBar: this.snackBar,
      projectUuid,
      metricQuery,
      format,
      csvMaxLimit: resolveCsvMaxLimit(this.appState.health()?.query?.csvMaxLimit),
      filenameBase: this.displayName() || this.displayTableLabel() || 'export',
      formatNumber: (value, options) => this.language.formatNumber(value, options),
      translate: (key, params) => this.translate.instant(key, params),
    });
  }

  protected onProjectNodeSelected(lineageNodeId: string): void {
    if (!this.editMode() || lineageNodeId === this.selectedTableId()) {
      return;
    }
    this.selectedTableId.set(lineageNodeId);
    this.switchExplore(lineageNodeId);
  }

  protected toggleConfigCollapsed(): void {
    const next = !this.configCollapsed();
    this.configCollapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(CONFIG_COLLAPSED_STORAGE_KEY, String(next));
    }
  }

  protected onConfigResizeStart(event: PointerEvent): void {
    if (this.configCollapsed()) {
      return;
    }

    const handle = event.currentTarget as HTMLElement;
    event.preventDefault();
    this.configIsDragging = true;
    this.configResizing.set(true);
    this.configStartX = event.clientX;
    this.configStartWidth = this.configPanelWidth();
    handle.setPointerCapture(event.pointerId);
    this.renderer.addClass(document.body, 'chart-view-config--resizing');

    this.configUnlistenMove = this.renderer.listen(
      'document',
      'pointermove',
      (moveEvent: PointerEvent) => this.onConfigResizeMove(moveEvent),
    );
    this.configUnlistenUp = this.renderer.listen(
      'document',
      'pointerup',
      (upEvent: PointerEvent) => this.onConfigResizeEnd(upEvent, handle),
    );
  }

  private onConfigResizeMove(event: PointerEvent): void {
    if (!this.configIsDragging || this.configCollapsed()) {
      return;
    }

    const width = this.clampConfigWidth(
      this.configStartWidth + (event.clientX - this.configStartX),
    );
    this.configPanelWidth.set(width);
  }

  private onConfigResizeEnd(event: PointerEvent, handle: HTMLElement): void {
    if (!this.configIsDragging) {
      return;
    }

    handle.releasePointerCapture(event.pointerId);
    this.stopConfigResize();

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(
        CONFIG_WIDTH_STORAGE_KEY,
        String(this.configPanelWidth()),
      );
    }
  }

  private stopConfigResize(): void {
    this.configIsDragging = false;
    this.configResizing.set(false);
    this.renderer.removeClass(document.body, 'chart-view-config--resizing');
    this.configUnlistenMove?.();
    this.configUnlistenUp?.();
    this.configUnlistenMove = undefined;
    this.configUnlistenUp = undefined;
  }

  private readConfigCollapsedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return localStorage.getItem(CONFIG_COLLAPSED_STORAGE_KEY) === 'true';
  }

  private readConfigSavedWidth(): number {
    const saved = localStorage.getItem(CONFIG_WIDTH_STORAGE_KEY);
    const parsed = saved ? Number.parseInt(saved, 10) : Number.NaN;
    return Number.isFinite(parsed)
      ? this.clampConfigWidth(parsed)
      : CONFIG_DEFAULT_WIDTH;
  }

  private clampConfigWidth(width: number): number {
    return Math.min(CONFIG_MAX_WIDTH, Math.max(CONFIG_MIN_WIDTH, width));
  }

  private initCreateMode(projectUuid: string): void {
    this.projectUuid.set(projectUuid);
    this.chartUuid.set(null);
    this.chart.set(null);
    this.explore.set(null);
    this.editMode.set(true);
    this.configureMode.set(false);
    this.draftName.set('');
    this.draftNameEdited.set(false);
    this.draftDescription.set('');
    this.chartConfig.set(defaultConfigForType('cartesian'));
    this.cachedChartConfigs.set({});
    this.selectedDimensions.set(new Set());
    this.selectedMetrics.set(new Set());
    this.additionalMetrics.set([]);
    this.fieldSearch.set('');
    this.dimensionFilters.set([]);
    this.metricQueryFilters.set({});
    this.timeTravel.set(null);
    this.queryResults.set(null);
    this.queryError.set(null);
    this.queryLoading.set(false);
    this.loading.set(false);
    this.error.set(null);
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.resultsPageIndex.set(0);
    this.selectedTableId.set(null);
    this.activeProjectService.setActiveProject(projectUuid);

    const pending = this.pendingCreateFromExplore;
    this.pendingCreateFromExplore = null;
    if (pending) {
      this.applyCreateFromExploreState(pending);
      this.loadExplore(projectUuid, pending.exploreName, false);
      this.loadProjectTree(projectUuid, pending.exploreName);
      return;
    }

    this.loadProjectTree(projectUuid, null);
  }

  private loadChart(projectUuid: string, chartUuid: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.queryError.set(null);
    this.dimensionFilters.set([]);
    this.metricQueryFilters.set({});
    this.timeTravel.set(null);
    this.fieldSearch.set('');
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.resultsPageIndex.set(0);
    this.selectedTableId.set(null);

    const cachedEntry = this.cacheEntries()[
      chartQueryKey({
        kind: 'savedChartView',
        projectUuid,
        savedChartUuid: chartUuid,
        dimensionFilters: [],
      })
    ];
    if (!cachedEntry?.snapshot?.queryResults) {
      this.queryResults.set(null);
    }

    this.chartService.get(projectUuid, chartUuid).subscribe({
      next: (chart) => {
        this.chart.set(chart);
        this.draftName.set(chart.name);
        this.draftNameEdited.set(true);
        this.draftDescription.set(chart.description ?? '');
        this.applySavedChartConfig(chart);
        this.applyMetricQuery(chart.metricQuery);
        this.loading.set(false);
        this.loadExplore(projectUuid, chart.tableName, false);
        this.loadProjectTree(projectUuid, chart.tableName);
      },
      error: (err) => {
        this.error.set(
          apiErrorMessage(
            err,
            this.translate.instant('charts.workspace.loadChartError'),
          ),
        );
        this.loading.set(false);
      },
    });
  }

  private applySavedChartConfig(chart: SavedChart): void {
    const normalized = normalizeChartConfig(chart.chartConfig);
    let next = normalized;

    if (next.type === 'cartesian') {
      next = applyChartPanelPatch(next, {
        xField:
          next.config.layout.xField ??
          chart.metricQuery.dimensions[0] ??
          null,
        yFields:
          next.config.layout.yFields?.length
            ? next.config.layout.yFields
            : chart.metricQuery.metrics[0]
              ? [chart.metricQuery.metrics[0]]
              : [],
        rowLimit: clampQueryLimit(
          next.config.rowLimit ?? chart.metricQuery.limit,
          this.maxQueryLimit(),
        ),
      });
    } else if (next.type === 'pie') {
      next = applyChartPanelPatch(next, {
        xField: next.config.xField ?? chart.metricQuery.dimensions[0] ?? null,
        yFields: next.config.yField
          ? [next.config.yField]
          : chart.metricQuery.metrics[0]
            ? [chart.metricQuery.metrics[0]]
            : [],
        rowLimit: clampQueryLimit(
          next.config.rowLimit ?? chart.metricQuery.limit,
          this.maxQueryLimit(),
        ),
      });
    } else if (next.type === 'big_number') {
      next = applyChartPanelPatch(next, {
        yFields: next.config.selectedField
          ? [next.config.selectedField]
          : chart.metricQuery.metrics[0]
            ? [chart.metricQuery.metrics[0]]
            : [],
        rowLimit: clampQueryLimit(
          next.config.rowLimit ?? chart.metricQuery.limit,
          this.maxQueryLimit(),
        ),
      });
    }

    this.chartConfig.set(next);
    this.cachedChartConfigs.set({});
  }

  private loadExplore(
    projectUuid: string,
    tableName: string,
    resetSelection: boolean,
  ): void {
    this.explorerService.getExplore(projectUuid, tableName).subscribe({
      next: (explore) => {
        if (!exploreHasFields(explore)) {
          this.explore.set(null);
          this.queryError.set(
            this.translate.instant('charts.workspace.fieldsUnavailable'),
          );
          return;
        }
        this.explore.set(explore);
        this.queryError.set(null);
        if (resetSelection) {
          this.setDefaultSelection(explore);
        } else if (this.dimensionFilters().length > 0) {
          // applyMetricQuery may have run before explore arrived; refresh labels.
          this.dimensionFilters.update((filters) =>
            enrichDashboardFilterLabels(filters, explore),
          );
        }
        this.runQuery();
      },
      error: (err) => {
        this.queryError.set(
          apiErrorMessage(
            err,
            this.translate.instant('charts.workspace.loadExploreFieldsError'),
          ),
        );
      },
    });
  }

  private ensureProjectTreeLoaded(): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid || this.dbtTree().length > 0 || this.projectTreeLoading()) {
      return;
    }
    this.loadProjectTree(projectUuid, this.explore()?.name ?? this.chart()?.tableName ?? null);
  }

  private loadProjectTree(projectUuid: string, tableName: string | null): void {
    this.projectTreeLoading.set(true);
    this.projectTreeError.set(null);
    this.lineageNodes.set([]);

    forkJoin({
      tree: this.lineageService.getDbtTree(projectUuid),
      explores: this.explorerService.listExplores(projectUuid),
    }).subscribe({
      next: ({ tree, explores }) => {
        this.dbtTree.set(tree.root);
        this.explores.set(
          [...explores].sort((left, right) =>
            left.label.localeCompare(right.label),
          ),
        );
        this.projectTreeLoading.set(false);
        this.syncSelectedTableId(tableName);
      },
      error: (err) => {
        this.projectTreeError.set(
          apiErrorMessage(
            err,
            this.translate.instant('charts.workspace.loadProjectTreeError'),
          ),
        );
        this.projectTreeLoading.set(false);
      },
    });

    this.lineageService.getProjectLineage(projectUuid).subscribe({
      next: (lineage) => this.lineageNodes.set(lineage.nodes),
      error: () => this.lineageNodes.set([]),
    });
  }

  private syncSelectedTableId(tableName: string | null): void {
    if (!tableName) {
      return;
    }
    const summary = findExploreByName(this.explores(), tableName);
    this.selectedTableId.set(summary?.lineageNodeId ?? tableName);
  }

  private switchExplore(lineageNodeId: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    this.resetExploreSelectionState();

    const treeNode = findTreeNodeByLineageId(this.dbtTree(), lineageNodeId);
    const exploreSummary = findExploreForLineageNode(
      this.explores(),
      lineageNodeId,
      treeNode,
    );
    const exploreName = resolveExploreNameForSelection(
      exploreSummary?.name,
      treeNode,
      lineageNodeId,
    );

    if (!exploreName) {
      this.explore.set(null);
      if (isExploreableDbtTreeNode(treeNode)) {
        this.queryError.set(
          this.translate.instant('charts.workspace.fieldsUnavailable'),
        );
      }
      return;
    }

    this.loadExplore(projectUuid, exploreName, true);
  }

  private resetExploreSelectionState(): void {
    const kind = this.chartKind();
    this.selectedDimensions.set(new Set());
    this.selectedMetrics.set(new Set());
    this.additionalMetrics.set([]);
    this.dimensionFilters.set([]);
    this.fieldSearch.set('');
    this.queryResults.set(null);
    this.queryError.set(null);
    this.resultsPageIndex.set(0);
    const result = applyChartKindChange(
      defaultConfigForType('cartesian'),
      {},
      kind,
    );
    this.chartConfig.set(result.chartConfig);
    this.cachedChartConfigs.set({});
    this.configureMode.set(false);
  }

  private setDefaultSelection(explore: Explore): void {
    const dimensions = new Set<FieldId>();
    const metrics = new Set<FieldId>();

    const firstTable = Object.values(explore.tables)[0];
    if (firstTable) {
      const firstDim = Object.values(firstTable.dimensions).find((dim) => !dim.hidden);
      if (firstDim) {
        dimensions.add(getFieldId(firstTable.name, firstDim.name));
      }
      const firstMetric = Object.values(firstTable.metrics).find(
        (metric) => !metric.hidden,
      );
      if (firstMetric) {
        metrics.add(getFieldId(firstTable.name, firstMetric.name));
      }
    }

    this.selectedDimensions.set(dimensions);
    this.selectedMetrics.set(metrics);
    this.syncChartAxisFields();
  }

  private applyMetricQuery(metricQuery: MetricQuery): void {
    this.selectedDimensions.set(new Set(metricQuery.dimensions));
    this.selectedMetrics.set(new Set(metricQuery.metrics));
    this.additionalMetrics.set(metricQuery.additionalMetrics);
    this.metricQueryFilters.set(metricQuery.filters ?? {});
    this.dimensionFilters.set(
      extractDashboardFiltersFromMetricQuery(metricQuery, this.explore() ?? undefined),
    );
    this.syncChartAxisFields();
  }

  private applyCreateFromExploreState(state: CreateChartFromExploreState): void {
    this.applyMetricQuery({
      exploreName: state.exploreName,
      dimensions: state.dimensions,
      metrics: state.metrics,
      filters: state.filters,
      sorts: state.sorts,
      limit: state.rowLimit,
      tableCalculations: [],
      additionalMetrics: state.additionalMetrics,
      ...(state.timeTravel ? { timeTravel: state.timeTravel } : {}),
    });
    this.dimensionFilters.set(state.dimensionFilters);
    this.setQueryRowLimit(state.rowLimit);
    this.timeTravel.set(state.timeTravel ?? null);
    this.metricQueryFilters.set(state.filters);
  }

  protected onFieldSearch(value: string): void {
    this.fieldSearch.set(value);
  }

  protected onAccordionFieldToggled(fieldId: FieldId): void {
    const isDimension = this.tableGroups().some((group) =>
      group.dimensions.some((field) => field.fieldId === fieldId),
    );
    if (isDimension) {
      this.toggleDimension(fieldId);
      return;
    }
    this.toggleMetric(fieldId);
  }

  protected toggleDimension(fieldId: FieldId): void {
    if (!this.editMode()) {
      return;
    }
    const next = new Set(this.selectedDimensions());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedDimensions.set(next);
    this.syncChartAxisFields();
  }

  protected toggleMetric(fieldId: FieldId): void {
    if (!this.editMode()) {
      return;
    }
    const next = new Set(this.selectedMetrics());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedMetrics.set(next);
    this.syncChartAxisFields();
  }

  protected getFieldLabel(fieldId: FieldId): string {
    const explore = this.explore();
    if (!explore) {
      return fieldId;
    }

    for (const table of Object.values(explore.tables)) {
      for (const dim of Object.values(table.dimensions)) {
        if (getFieldId(table.name, dim.name) === fieldId) {
          return dim.label;
        }
      }
      for (const metric of Object.values(table.metrics)) {
        if (getFieldId(table.name, metric.name) === fieldId) {
          return metric.label;
        }
      }
    }

    const additionalMetric = this.additionalMetrics().find(
      (metric) => getFieldId(metric.tableName, metric.name) === fieldId,
    );
    if (additionalMetric) {
      return additionalMetric.label;
    }

    return fieldId;
  }

  protected setChartKind(kind: ChartKind): void {
    const result = applyChartKindChange(
      this.chartConfig(),
      this.cachedChartConfigs(),
      kind,
    );
    this.chartConfig.set(result.chartConfig);
    this.cachedChartConfigs.set(result.cache);

    if (kind === 'big_number' || kind === 'gauge') {
      this.ensureBigNumberMetric();
    } else {
      this.syncChartAxisFields();
    }
  }

  protected setChartXField(fieldId: FieldId): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), { xField: fieldId }),
    );
  }

  protected setChartYFields(fieldIds: FieldId[]): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), { yFields: fieldIds }),
    );
  }


  protected setChartDisplayConfig(config: ChartDisplayConfig): void {
    const next = {
      ...config,
      rowLimit: clampQueryLimit(config.rowLimit, this.maxQueryLimit()),
    };
    this.chartConfig.set(applyChartPanelPatch(this.chartConfig(), next));
  }

  protected setFunnelDataInput(dataInput: 'column' | 'row'): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), { funnelDataInput: dataInput }),
    );
  }

  protected setTreemapDimensionFieldIds(fieldIds: FieldId[]): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), {
        treemapDimensionFieldIds: fieldIds,
      }),
    );
  }

  protected setGaugeMin(min: number | undefined): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), { gaugeMin: min }),
    );
  }

  protected setGaugeMax(max: number | undefined): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), { gaugeMax: max }),
    );
  }

  protected setShowGaugeLabel(show: boolean): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), { showGaugeLabel: show }),
    );
  }

  protected setSankeySourceFieldId(fieldId: FieldId): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), {
        sankeySourceFieldId: fieldId,
      }),
    );
  }

  protected setSankeyTargetFieldId(fieldId: FieldId): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), {
        sankeyTargetFieldId: fieldId,
      }),
    );
  }

  protected setSankeyWeightFieldId(fieldId: FieldId): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), {
        sankeyWeightFieldId: fieldId,
      }),
    );
  }

  protected setShowNodeLabels(show: boolean): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), { showNodeLabels: show }),
    );
  }

  protected setQueryRowLimit(limit: number): void {
    this.chartConfig.set(
      applyChartPanelPatch(this.chartConfig(), {
        rowLimit: clampQueryLimit(limit, this.maxQueryLimit()),
      }),
    );
  }

  protected saveChart(): void {
    if (!this.canSave()) {
      return;
    }

    if (this.isCreateMode()) {
      this.openCreateSaveDialog();
      return;
    }

    this.saveExistingChart();
  }

  private openCreateSaveDialog(): void {
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    if (!projectUuid || !explore) {
      return;
    }

    const suggestedName =
      this.effectiveDraftName().trim() || explore.label || explore.name;

    const dialogRef = this.dialog.open<
      SaveChartDialogComponent,
      SaveChartDialogData,
      SaveChartDialogResult
    >(SaveChartDialogComponent, {
      data: {
        projectUuid,
        suggestedName,
      },
      width: '24rem',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.createChart(projectUuid, explore, result.name, result.spaceUuid);
    });
  }

  private createChart(
    projectUuid: string,
    explore: Explore,
    name: string,
    spaceUuid: string,
  ): void {
    this.saveLoading.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const baseMetricQuery: MetricQuery = {
      exploreName: explore.name,
      dimensions: this.selectedDimensionList(),
      metrics: this.selectedMetricList(),
      filters: {},
      sorts: [],
      limit: clampQueryLimit(
        this.chartDisplayConfig().rowLimit,
        this.maxQueryLimit(),
      ),
      tableCalculations: [],
      additionalMetrics: this.additionalMetrics(),
    };

    this.chartService
      .create(projectUuid, {
        name,
        spaceUuid,
        description: this.draftDescription().trim() || undefined,
        tableName: explore.name,
        chartKind: chartKindFromConfig(this.chartConfig()),
        metricQuery: mergeDashboardFiltersIntoMetricQuery(
          baseMetricQuery,
          this.dimensionFilters(),
          explore,
        ),
        chartConfig: this.chartConfig(),
      })
      .subscribe({
        next: (created) => {
          this.saveLoading.set(false);
          void this.router.navigate([
            '/projects',
            projectUuid,
            'charts',
            created.uuid,
          ]);
        },
        error: (err) => {
          this.saveError.set(
            apiErrorMessage(
              err,
              this.translate.instant('charts.workspace.saveError'),
            ),
          );
          this.saveLoading.set(false);
        },
      });
  }

  private saveExistingChart(): void {
    const projectUuid = this.projectUuid();
    const chartUuid = this.chartUuid();
    const chart = this.chart();
    const explore = this.explore();
    const name = this.draftName().trim();

    if (!projectUuid || !chartUuid || !chart || !explore) {
      return;
    }

    this.saveLoading.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const baseMetricQuery: MetricQuery = {
      exploreName: explore.name,
      dimensions: this.selectedDimensionList(),
      metrics: this.selectedMetricList(),
      filters: {},
      sorts: [],
      limit: clampQueryLimit(
        this.chartDisplayConfig().rowLimit,
        this.maxQueryLimit(),
      ),
      tableCalculations: [],
      additionalMetrics: this.additionalMetrics(),
    };

    this.chartService
      .update(projectUuid, chartUuid, {
        name,
        description: this.draftDescription().trim() || undefined,
        chartKind: chartKindFromConfig(this.chartConfig()),
        tableName: explore.name,
        metricQuery: mergeDashboardFiltersIntoMetricQuery(
          baseMetricQuery,
          this.dimensionFilters(),
          explore,
        ),
        chartConfig: this.chartConfig(),
      })
      .subscribe({
        next: (updated) => {
          this.chart.set(updated);
          this.draftName.set(updated.name);
          this.draftNameEdited.set(true);
          this.draftDescription.set(updated.description ?? '');
          this.saveLoading.set(false);
          this.saveSuccess.set(true);
        },
        error: (err) => {
          this.saveError.set(
            apiErrorMessage(
              err,
              this.translate.instant('charts.workspace.saveError'),
            ),
          );
          this.saveLoading.set(false);
        },
      });
  }

  private syncChartAxisFields(): void {
    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();
    const currentX = this.chartXField();
    const currentY = this.chartYFields();
    const kind = this.chartKind();
    const patch: {
      xField?: FieldId | null;
      yFields?: FieldId[];
      treemapDimensionFieldIds?: FieldId[];
    } = {};

    if (kind === 'funnel') {
      if (!currentX || !metrics.includes(currentX)) {
        patch.xField = metrics[0] ?? null;
      }

      const labelField = currentY[0];
      if (labelField && !dimensions.includes(labelField)) {
        patch.yFields = [];
      }

      if (patch.xField !== undefined || patch.yFields !== undefined) {
        this.chartConfig.set(applyChartPanelPatch(this.chartConfig(), patch));
      }
      return;
    }

    if (kind === 'treemap') {
      const currentMetric = currentY[0];
      if (!currentMetric || !metrics.includes(currentMetric)) {
        patch.yFields = metrics[0] ? [metrics[0]] : [];
      }

      const currentDims = this.panelView().treemapDimensionFieldIds ?? [];
      const validDims = currentDims.filter((fieldId) =>
        dimensions.includes(fieldId),
      );
      if (validDims.length === 0) {
        patch.treemapDimensionFieldIds =
          dimensions.length > 0 ? [dimensions[0]] : [];
      } else if (validDims.length !== currentDims.length) {
        patch.treemapDimensionFieldIds = validDims;
      }

      if (
        patch.yFields !== undefined ||
        patch.treemapDimensionFieldIds !== undefined
      ) {
        this.chartConfig.set(applyChartPanelPatch(this.chartConfig(), patch));
      }
      return;
    }

    if (kind === 'sankey') {
      const view = this.panelView();
      const sankeyPatch: {
        sankeySourceFieldId?: FieldId | null;
        sankeyTargetFieldId?: FieldId | null;
        sankeyWeightFieldId?: FieldId | null;
      } = {};
      const source = view.sankeySourceFieldId;
      const target = view.sankeyTargetFieldId;
      const weight = view.sankeyWeightFieldId;

      if (!source || !dimensions.includes(source)) {
        sankeyPatch.sankeySourceFieldId = dimensions[0] ?? null;
      }
      if (
        !target ||
        !dimensions.includes(target) ||
        target === (sankeyPatch.sankeySourceFieldId ?? source)
      ) {
        sankeyPatch.sankeyTargetFieldId =
          dimensions.find(
            (fieldId) =>
              fieldId !== (sankeyPatch.sankeySourceFieldId ?? source),
          ) ?? null;
      }
      if (!weight || !metrics.includes(weight)) {
        sankeyPatch.sankeyWeightFieldId = metrics[0] ?? null;
      }

      if (
        sankeyPatch.sankeySourceFieldId !== undefined ||
        sankeyPatch.sankeyTargetFieldId !== undefined ||
        sankeyPatch.sankeyWeightFieldId !== undefined
      ) {
        this.chartConfig.set(
          applyChartPanelPatch(this.chartConfig(), sankeyPatch),
        );
      }
      return;
    }

    if (kind !== 'big_number' && kind !== 'gauge') {
      if (!currentX || !dimensions.includes(currentX)) {
        patch.xField = dimensions[0] ?? null;
      }
    }

    const validY = currentY.filter((fieldId) => metrics.includes(fieldId));
    if (validY.length === 0) {
      patch.yFields = metrics[0] ? [metrics[0]] : [];
    } else if (kind === 'big_number' || kind === 'gauge') {
      patch.yFields = [validY[0]];
    } else {
      patch.yFields = validY;
    }

    if (patch.xField !== undefined || patch.yFields !== undefined) {
      this.chartConfig.set(applyChartPanelPatch(this.chartConfig(), patch));
    }
  }

  private ensureBigNumberMetric(): void {
    const metrics = this.selectedMetricList();
    const currentY = this.chartYFields().filter((fieldId) =>
      metrics.includes(fieldId),
    );
    const yFields =
      currentY.length === 0
        ? metrics[0]
          ? [metrics[0]]
          : []
        : [currentY[0]];
    this.chartConfig.set(applyChartPanelPatch(this.chartConfig(), { yFields }));
  }

  protected runQuery(): void {
    const input = this.queryCacheInput();
    if (!input) {
      this.queryResults.set(null);
      return;
    }

    const cacheKey = chartQueryKey(input);
    const cachedEntry = this.cacheEntries()[cacheKey];
    if (cachedEntry?.status === 'success' && cachedEntry.snapshot?.queryResults) {
      this.queryResults.set(cachedEntry.snapshot.queryResults);
      if (cachedEntry.snapshot.chartConfig) {
        this.chartConfig.set(cachedEntry.snapshot.chartConfig);
      }
      this.resultsPageIndex.set(0);
      this.queryLoading.set(false);
      this.queryError.set(null);
      return;
    }

    if (cachedEntry?.status === 'loading') {
      this.queryLoading.set(!cachedEntry.snapshot?.queryResults);
      return;
    }

    this.queryLoading.set(!cachedEntry?.snapshot?.queryResults);
    this.queryError.set(null);
    this.store.dispatch(ChartQueryActions.load({ key: cacheKey, input }));
  }

  private queryCacheInput(): ChartQueryKeyInput | null {
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    const chartUuid = this.chartUuid();

    if (!projectUuid) {
      return null;
    }

    if (!this.editMode() && !this.isCreateMode() && chartUuid) {
      return {
        kind: 'savedChartView',
        projectUuid,
        savedChartUuid: chartUuid,
        dimensionFilters: this.dimensionFilters(),
      };
    }

    if (!explore) {
      return null;
    }

    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();
    if (dimensions.length === 0 && metrics.length === 0) {
      return null;
    }

    return {
      kind: 'metricQuery',
      projectUuid,
      metricQuery: {
        exploreName: explore.name,
        dimensions,
        metrics,
        filters: this.metricQueryFilters(),
        sorts: [],
        limit: clampQueryLimit(
          this.chartDisplayConfig().rowLimit,
          this.maxQueryLimit(),
        ),
        tableCalculations: [],
        additionalMetrics: this.additionalMetrics(),
      },
      dimensionFilters: this.dimensionFilters(),
      timeTravel: this.timeTravel(),
    };
  }
}
