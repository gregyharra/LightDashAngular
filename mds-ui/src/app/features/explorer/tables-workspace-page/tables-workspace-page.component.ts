import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { DashboardDimensionFilter } from '../../../core/models/dashboard.model';
import { DbtTreeNode, LineageNode } from '../../../core/models/lineage.model';
import {
  ChartConfig,
  ChartKind,
  defaultConfigForType,
} from '../../../core/models/chart.model';
import {
  applyChartKindChange,
  applyChartPanelPatch,
  chartKindFromConfig,
  ChartConfigCache,
  toChartPanelView,
} from '../../../core/models/chart-config.utils';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  AdditionalMetric,
  Explore,
  ExploreSummary,
  FieldId,
  MetricQuery,
  QueryResults,
  QueryWarning,
  TimeTravelConfig,
  getFieldId,
} from '../../../core/models/explore.model';
import { FolderSearchPanelComponent } from '../../lineage/folder-search-panel/folder-search-panel.component';
import { findTreeNodeByLineageId } from '../../lineage/dbt-tree-utils';
import { LineageService } from '../../lineage/lineage.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { ProjectBrowseNavComponent } from '../../../layout/project-browse-nav/project-browse-nav.component';
import {
  filterTablesFieldGroups,
  TablesFieldGroup,
  TablesFieldsPanelComponent,
} from '../tables-fields-panel/tables-fields-panel.component';
import { ChartVisualizationComponent } from '../../charts/chart-visualization/chart-visualization.component';
import { TablesChartConfigPanelComponent } from '../tables-chart-config-panel/tables-chart-config-panel.component';
import { TablesChartDisplayConfig } from '../tables-chart-config-panel/tables-chart-config.constants';
import {
  findExploreByName,
  findExploreForLineageNode,
} from '../explore-lineage.utils';
import {
  exploreHasFields,
  formatModelLabel,
  isExploreableDbtTreeNode,
  resolveExploreNameForSelection,
} from '../explore-from-dbt.utils';
import { buildMetricQuerySql } from '../metric-query-sql.utils';
import { ExplorerService } from '../explorer.service';
import { mergeDashboardFiltersIntoMetricQuery } from '../../dashboards/dashboard-filters';
import {
  ChartQueryActions,
  ChartQueryEntry,
  ChartQueryKeyInput,
  chartQueryKey,
  selectEntries,
} from '../../../core/store';
import { mergeTimeTravelIntoMetricQuery } from '../time-travel.utils';
import { getFilterableDimensions } from '../tables-filters-panel/tables-filters.utils';
import { TablesFiltersPanelComponent } from '../tables-filters-panel/tables-filters-panel.component';
import { TimeTravelControlComponent } from '../../../shared/time-travel-control/time-travel-control.component';
import { QueryWarningsBannerComponent } from '../../../shared/query-warnings-banner/query-warnings-banner.component';
import { RunQueryButtonComponent } from '../../../shared/run-query-button/run-query-button.component';
import { SqlHighlightComponent } from '../../../shared/sql-highlight/sql-highlight.component';
import { AppStateService } from '../../../core/services/app-state.service';
import { ChartService } from '../../charts/chart.service';
import {
  clampQueryLimit,
  resolveMaxQueryLimit,
} from '../query-limit.utils';
import {
  SaveChartDialogComponent,
  SaveChartDialogResult,
} from '../../charts/save-chart-dialog/save-chart-dialog.component';
import {
  CustomMetricDialogComponent,
  CustomMetricDialogData,
  CustomMetricDialogResult,
} from '../custom-metric/custom-metric-dialog.component';
import {
  LdButtonComponent,
  LdEmptyStateComponent,
} from '../../../design-system';

@Component({
  selector: 'app-tables-workspace-page',
  imports: [
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    TranslatePipe,
    FolderSearchPanelComponent,
    TablesFieldsPanelComponent,
    TablesChartConfigPanelComponent,
    ChartVisualizationComponent,
    TablesFiltersPanelComponent,
    TimeTravelControlComponent,
    QueryWarningsBannerComponent,
    RunQueryButtonComponent,
    SqlHighlightComponent,
    ResizableSidebarDirective,
    ProjectBrowseNavComponent,
    LdButtonComponent,
    LdEmptyStateComponent,
  ],
  templateUrl: './tables-workspace-page.component.html',
  styleUrl: './tables-workspace-page.component.scss',
})
export class TablesWorkspacePageComponent {
  private readonly timeTravelControl = viewChild(TimeTravelControlComponent);

  private readonly explorerService = inject(ExplorerService);
  private readonly lineageService = inject(LineageService);
  private readonly chartService = inject(ChartService);
  private readonly dialog = inject(MatDialog);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appState = inject(AppStateService);
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);
  private readonly activeProjectService = inject(ActiveProjectService);

  private readonly cacheEntries = toSignal(this.store.select(selectEntries), {
    initialValue: {} as Record<string, ChartQueryEntry>,
  });

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly tableId = signal<string | null>(null);
  protected readonly dbtTree = signal<DbtTreeNode[]>([]);
  protected readonly lineageNodes = signal<LineageNode[]>([]);
  protected readonly explores = signal<ExploreSummary[]>([]);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly listLoading = signal(true);
  protected readonly exploreLoading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly exploreError = signal<string | null>(null);

  protected readonly fieldSearch = signal('');
  protected readonly selectedFields = signal<Set<FieldId>>(new Set());
  protected readonly additionalMetrics = signal<AdditionalMetric[]>([]);
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly hasRunQuery = signal(false);
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
  protected readonly chartConfigOpen = signal(false);
  protected readonly dimensionFilters = signal<DashboardDimensionFilter[]>([]);
  protected readonly timeTravel = signal<TimeTravelConfig | null>(null);
  protected readonly queryWarnings = signal<QueryWarning[]>([]);
  protected readonly saveChartLoading = signal(false);

  protected readonly maxQueryLimit = computed(() =>
    resolveMaxQueryLimit(this.appState.health()?.query?.maxLimit),
  );

  protected readonly queryRowLimit = computed(() =>
    clampQueryLimit(this.chartDisplayConfig().rowLimit, this.maxQueryLimit()),
  );

  protected readonly selectedTreeNode = computed(() => {
    const nodeId = this.tableId();
    if (!nodeId) {
      return null;
    }

    return findTreeNodeByLineageId(this.dbtTree(), nodeId);
  });

  protected readonly isExploreableNode = computed(() =>
    isExploreableDbtTreeNode(this.selectedTreeNode()),
  );

  protected readonly selectedNodeLabel = computed(() => {
    const explore = this.explore();
    if (explore) {
      return explore.label;
    }

    const nodeId = this.tableId();
    if (!nodeId) {
      return '';
    }

    const node = this.selectedTreeNode();
    return node?.name ?? nodeId;
  });

  protected readonly tableGroups = computed<TablesFieldGroup[]>(() => {
    const explore = this.explore();
    if (!explore) {
      return [];
    }

    const tableGroups = Object.values(explore.tables).map((table) => {
      const exploreMetricFieldIds = new Set(
        Object.values(table.metrics)
          .filter((metric) => !metric.hidden)
          .map((metric) => getFieldId(table.name, metric.name)),
      );

      return {
        trackKey: `table:${table.name}`,
        table,
        dimensions: Object.values(table.dimensions)
          .filter((dim) => !dim.hidden)
          .map((dim) => ({
            fieldId: getFieldId(table.name, dim.name),
            label: dim.label,
            type: dim.type,
          })),
        metrics: Object.values(table.metrics)
          .filter((metric) => !metric.hidden)
          .map((metric) => ({
            fieldId: getFieldId(table.name, metric.name),
            label: metric.label,
          }))
          .concat(
            this.additionalMetrics()
              .filter((metric) => metric.tableName === table.name)
              .map((metric) => ({
                fieldId: getFieldId(metric.tableName, metric.name),
                label: metric.label,
              }))
              .filter(
                (customMetric) =>
                  !exploreMetricFieldIds.has(customMetric.fieldId),
              ),
          ),
      };
    });

    const issueGroups = (explore.joinIssues ?? []).map((issue, index) => ({
      trackKey: `issue:${issue.table}:${issue.code}:${index}`,
      table: {
        name: issue.table,
        label: issue.label || formatModelLabel(issue.table),
      },
      dimensions: [],
      metrics: [],
      issue,
    }));

    return [...tableGroups, ...issueGroups];
  });

  protected readonly customMetricDimensions = computed(() =>
    this.tableGroups().flatMap((group) =>
      group.dimensions.map((dimension) => ({
        ...dimension,
        tableLabel: group.table.label,
        tableName: group.table.name,
      })),
    ),
  );

  protected readonly canCreateCustomMetric = computed(
    () => this.customMetricDimensions().length > 0,
  );

  protected readonly filteredTableGroups = computed(() => {
    return filterTablesFieldGroups(this.tableGroups(), this.fieldSearch());
  });

  protected readonly selectedFieldList = computed(() =>
    Array.from(this.selectedFields()),
  );

  protected readonly selectedDimensionList = computed(() =>
    this.selectedFieldList().filter((fieldId) => !this.isMetricField(fieldId)),
  );

  protected readonly selectedMetricList = computed(() =>
    this.selectedFieldList().filter((fieldId) => this.isMetricField(fieldId)),
  );

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

  protected readonly canSaveChart = computed(
    () =>
      this.hasRunQuery() &&
      this.canRenderChart() &&
      !this.queryLoading() &&
      !this.queryError() &&
      !!this.explore() &&
      !this.saveChartLoading(),
  );

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

  protected readonly columnLabels = computed(() => {
    const results = this.queryResults();
    if (!results) {
      return {} as Record<FieldId, string>;
    }

    const labels: Record<FieldId, string> = {};
    for (const [fieldId, field] of Object.entries(results.fields)) {
      labels[fieldId] = field.label;
    }
    return labels;
  });

  protected readonly filterableDimensions = computed(() => {
    const explore = this.explore();
    if (!explore) {
      return [];
    }
    return getFilterableDimensions(explore);
  });

  protected readonly displaySql = computed(() => {
    const executedSql = this.queryResults()?.compiledSql;
    if (executedSql) {
      return executedSql;
    }
    return this.generatedSql();
  });

  protected readonly generatedSql = computed(() => {
    const explore = this.explore();
    if (!explore) {
      return null;
    }

    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();

    if (dimensions.length === 0 && metrics.length === 0) {
      return null;
    }

    return buildMetricQuerySql(
      explore,
      dimensions,
      metrics,
      this.queryRowLimit(),
      this.dimensionFilters(),
      this.timeTravel(),
    );
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const tableIdFromParams = params.get('tableId') ?? null;

      if (!projectUuid) {
        return;
      }

      const tableId =
        tableIdFromParams ?? this.route.snapshot.queryParamMap.get('table');

      const prevProject = this.projectUuid();
      this.projectUuid.set(projectUuid);
      this.tableId.set(tableId);
      this.activeProjectService.setActiveProject(projectUuid);

      if (prevProject !== projectUuid || this.dbtTree().length === 0) {
        this.loadWorkspaceData(projectUuid, tableId);
      } else {
        this.syncSelectionFromRoute(projectUuid, tableId);
      }
    });

    this.route.queryParamMap.subscribe((query) => {
      const projectUuid = this.projectUuid();
      if (!projectUuid || this.route.snapshot.paramMap.get('tableId')) {
        return;
      }

      const tableId = query.get('table');
      if (tableId === this.tableId()) {
        return;
      }

      this.tableId.set(tableId);
      if (this.dbtTree().length > 0) {
        this.syncSelectionFromRoute(projectUuid, tableId);
      }
    });

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
        this.queryWarnings.set(entry.snapshot.queryResults.warnings ?? []);
        this.hasRunQuery.set(true);
      }

      if (entry.status === 'loading') {
        this.queryLoading.set(!entry.snapshot?.queryResults);
        this.queryError.set(null);
      } else if (entry.status === 'success') {
        this.queryLoading.set(false);
        this.queryError.set(null);
      } else if (entry.status === 'error') {
        this.queryWarnings.set([]);
        this.queryError.set(
          entry.error ?? this.translate.instant('common.queryFailed'),
        );
        this.queryLoading.set(false);
      }
    });
  }

  private loadWorkspaceData(
    projectUuid: string,
    tableId: string | null,
  ): void {
    this.listLoading.set(true);
    this.listError.set(null);
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
        this.listLoading.set(false);
        this.syncSelectionFromRoute(projectUuid, tableId);
      },
      error: (err) => {
        this.listError.set(
          apiErrorMessage(
            err,
            this.translate.instant('charts.workspace.loadProjectTreeError'),
          ),
        );
        this.listLoading.set(false);
      },
    });

    this.lineageService.getProjectLineage(projectUuid).subscribe({
      next: (lineage) => this.lineageNodes.set(lineage.nodes),
      error: () => this.lineageNodes.set([]),
    });
  }

  private syncSelectionFromRoute(
    projectUuid: string,
    tableId: string | null,
  ): void {
    if (!tableId) {
      this.explore.set(null);
      this.exploreLoading.set(false);
      this.exploreError.set(null);
      this.resetQueryState();
      return;
    }

    const legacyExplore = findExploreByName(this.explores(), tableId);
    if (
      legacyExplore?.lineageNodeId &&
      legacyExplore.lineageNodeId !== tableId
    ) {
      void this.router.navigate(
        ['/projects', projectUuid, 'charts', 'new'],
        { queryParams: { table: legacyExplore.lineageNodeId }, replaceUrl: true },
      );
      return;
    }

    this.loadExploreForSelection(
      projectUuid,
      legacyExplore?.lineageNodeId ?? tableId,
    );
  }

  private loadExploreForSelection(
    projectUuid: string,
    lineageNodeId: string,
  ): void {
    this.exploreLoading.set(true);
    this.exploreError.set(null);
    this.resetQueryState();

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
      this.exploreLoading.set(false);
      if (isExploreableDbtTreeNode(treeNode)) {
        this.exploreError.set(
          this.translate.instant('charts.workspace.fieldsUnavailable'),
        );
      }
      return;
    }

    this.explorerService
      .getExplore(projectUuid, exploreName)
      .subscribe({
        next: (explore) => {
          if (!exploreHasFields(explore)) {
            this.explore.set(null);
            this.exploreError.set(
              this.translate.instant('charts.workspace.fieldsUnavailable'),
            );
          } else {
            this.explore.set(explore);
            this.exploreError.set(null);
            this.setDefaultSelection(explore);
          }
          this.exploreLoading.set(false);
        },
        error: (err) => {
          this.exploreError.set(
            apiErrorMessage(
              err,
              this.translate.instant('charts.workspace.loadExploreFieldsError'),
            ),
          );
          this.exploreLoading.set(false);
        },
      });
  }

  private resetQueryState(): void {
    this.selectedFields.set(new Set());
    this.additionalMetrics.set([]);
    this.queryResults.set(null);
    this.queryError.set(null);
    this.hasRunQuery.set(false);
    this.fieldSearch.set('');
    this.chartConfig.set(defaultConfigForType('cartesian'));
    this.cachedChartConfigs.set({});
    this.chartConfigOpen.set(false);
    this.dimensionFilters.set([]);
    this.timeTravel.set(null);
    this.queryWarnings.set([]);
  }

  private setDefaultSelection(explore: Explore): void {
    const defaults = new Set<FieldId>();

    const ordersDims = [
      getFieldId('orders', 'order_id'),
      getFieldId('orders', 'status'),
      getFieldId('orders', 'order_date'),
      getFieldId('customers', 'first_name'),
    ];
    const ordersMetrics = [getFieldId('orders', 'order_count')];

    for (const fieldId of [...ordersDims, ...ordersMetrics]) {
      if (this.fieldExistsInExplore(explore, fieldId)) {
        defaults.add(fieldId);
      }
    }

    if (defaults.size === 0) {
      const firstTable = Object.values(explore.tables)[0];
      if (firstTable) {
        const firstDim = Object.values(firstTable.dimensions)[0];
        if (firstDim) {
          defaults.add(getFieldId(firstTable.name, firstDim.name));
        }

        const firstMetric = Object.values(firstTable.metrics)[0];
        if (firstMetric) {
          defaults.add(getFieldId(firstTable.name, firstMetric.name));
        }
      }
    }

    this.selectedFields.set(defaults);
    this.syncChartAxisFields();
  }

  private fieldExistsInExplore(explore: Explore, fieldId: FieldId): boolean {
    for (const table of Object.values(explore.tables)) {
      for (const dim of Object.values(table.dimensions)) {
        if (getFieldId(table.name, dim.name) === fieldId) {
          return true;
        }
      }
      for (const metric of Object.values(table.metrics)) {
        if (getFieldId(table.name, metric.name) === fieldId) {
          return true;
        }
      }
    }
    return false;
  }

  protected onFieldSearch(value: string): void {
    this.fieldSearch.set(value);
  }

  protected onNodeSelected(lineageNodeId: string): void {
    this.selectNode(lineageNodeId);
  }

  protected selectNode(lineageNodeId: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'charts', 'new'], {
      queryParams: { table: lineageNodeId },
    });
  }

  protected toggleField(fieldId: FieldId): void {
    const next = new Set(this.selectedFields());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedFields.set(next);
    this.syncChartAxisFields();
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


  protected setChartDisplayConfig(config: TablesChartDisplayConfig): void {
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

  protected toggleChartConfig(event: Event): void {
    event.stopPropagation();
    this.chartConfigOpen.update((open) => !open);
  }

  protected closeChartConfig(): void {
    this.chartConfigOpen.set(false);
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
      if (!target || !dimensions.includes(target) || target === (sankeyPatch.sankeySourceFieldId ?? source)) {
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

  protected isMetricField(fieldId: FieldId): boolean {
    if (
      this.additionalMetrics().some(
        (metric) => getFieldId(metric.tableName, metric.name) === fieldId,
      )
    ) {
      return true;
    }

    const explore = this.explore();
    if (!explore) {
      return false;
    }

    for (const table of Object.values(explore.tables)) {
      for (const metric of Object.values(table.metrics)) {
        if (getFieldId(table.name, metric.name) === fieldId) {
          return true;
        }
      }
    }
    return false;
  }

  protected getFieldLabel(fieldId: FieldId): string {
    const additionalMetric = this.additionalMetrics().find(
      (metric) => getFieldId(metric.tableName, metric.name) === fieldId,
    );
    if (additionalMetric) {
      return additionalMetric.label;
    }

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

    return fieldId;
  }

  protected getColumnLabel(fieldId: FieldId): string {
    return this.columnLabels()[fieldId] || this.getFieldLabel(fieldId);
  }

  protected readonly getFieldLabelFn = (fieldId: FieldId): string =>
    this.getFieldLabel(fieldId);

  protected onDimensionFiltersChange(filters: DashboardDimensionFilter[]): void {
    this.dimensionFilters.set(filters);
  }

  protected onTimeTravelChange(timeTravel: TimeTravelConfig | null): void {
    this.timeTravel.set(timeTravel);
  }

  private resolveTimeTravelForQuery(): TimeTravelConfig | null {
    return this.timeTravelControl()?.resolveValue() ?? this.timeTravel();
  }

  protected runQuery(): void {
    const input = this.queryCacheInput();
    if (!input) {
      return;
    }

    const cacheKey = chartQueryKey(input);
    const cachedEntry = this.cacheEntries()[cacheKey];
    if (cachedEntry?.status === 'success' && cachedEntry.snapshot?.queryResults) {
      this.queryResults.set(cachedEntry.snapshot.queryResults);
      this.queryWarnings.set(cachedEntry.snapshot.queryResults.warnings ?? []);
      this.hasRunQuery.set(true);
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
    this.queryWarnings.set([]);
    this.hasRunQuery.set(true);
    this.store.dispatch(ChartQueryActions.load({ key: cacheKey, input }));
  }

  private queryCacheInput(): ChartQueryKeyInput | null {
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    const selected = this.selectedFieldList();

    if (!projectUuid || !explore || selected.length === 0) {
      return null;
    }

    const dimensions = selected.filter((id) => !this.isMetricField(id));
    const metrics = selected.filter((id) => this.isMetricField(id));
    const selectedMetricIds = new Set(metrics);
    const additionalMetrics = this.additionalMetrics().filter((metric) =>
      selectedMetricIds.has(getFieldId(metric.tableName, metric.name)),
    );

    return {
      kind: 'metricQuery',
      projectUuid,
      metricQuery: {
        exploreName: explore.name,
        dimensions,
        metrics,
        filters: {},
        sorts: [],
        limit: this.queryRowLimit(),
        tableCalculations: [],
        additionalMetrics,
      },
      dimensionFilters: this.dimensionFilters(),
      timeTravel: this.resolveTimeTravelForQuery(),
    };
  }

  protected openCustomMetricDialog(): void {
    const explore = this.explore();
    const dimensions = this.customMetricDimensions();
    if (!explore || dimensions.length === 0) {
      return;
    }

    const dialogRef = this.dialog.open<
      CustomMetricDialogComponent,
      CustomMetricDialogData,
      CustomMetricDialogResult
    >(CustomMetricDialogComponent, {
      data: {
        dimensions,
      },
      width: '34rem',
      maxWidth: '90vw',
      panelClass: 'custom-metric-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((metric) => {
      if (!metric) {
        return;
      }

      const fieldId = getFieldId(metric.tableName, metric.name);
      this.additionalMetrics.update((metrics) => [
        ...metrics.filter(
          (existing) =>
            getFieldId(existing.tableName, existing.name) !== fieldId,
        ),
        metric,
      ]);
      this.selectedFields.update((selected) => new Set([...selected, fieldId]));
      this.syncChartAxisFields();
    });
  }

  protected openSaveChartDialog(): void {
    const projectUuid = this.projectUuid();
    const explore = this.explore();

    if (!projectUuid || !explore || !this.canSaveChart()) {
      return;
    }

    const dialogRef = this.dialog.open<
      SaveChartDialogComponent,
      { projectUuid: string; suggestedName?: string },
      SaveChartDialogResult
    >(SaveChartDialogComponent, {
      data: {
        projectUuid,
        suggestedName: `${this.selectedNodeLabel()} chart`,
      },
      width: '24rem',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }

      this.saveChartLoading.set(true);

      this.chartService
        .create(projectUuid, {
          name: result.name,
          spaceUuid: result.spaceUuid,
          tableName: explore.name,
          chartKind: chartKindFromConfig(this.chartConfig()),
          metricQuery: this.buildCurrentMetricQuery(this.resolveTimeTravelForQuery()),
          chartConfig: this.chartConfig(),
        })
        .subscribe({
          next: (chart) => {
            this.saveChartLoading.set(false);
            void this.router.navigate([
              '/projects',
              projectUuid,
              'charts',
              chart.uuid,
            ]);
          },
          error: () => {
            this.saveChartLoading.set(false);
          },
        });
    });
  }

  private buildCurrentMetricQuery(
    timeTravel: TimeTravelConfig | null = this.resolveTimeTravelForQuery(),
  ): MetricQuery {
    const explore = this.explore();
    const selected = this.selectedFieldList();
    const dimensions = selected.filter((id) => !this.isMetricField(id));
    const metrics = selected.filter((id) => this.isMetricField(id));
    const selectedMetricIds = new Set(metrics);
    const additionalMetrics = this.additionalMetrics().filter((metric) =>
      selectedMetricIds.has(getFieldId(metric.tableName, metric.name)),
    );

    return mergeTimeTravelIntoMetricQuery(
      mergeDashboardFiltersIntoMetricQuery(
        {
          exploreName: explore!.name,
          dimensions,
          metrics,
          filters: {},
          sorts: [],
          limit: this.queryRowLimit(),
          tableCalculations: [],
          additionalMetrics,
        },
        this.dimensionFilters(),
      ),
      timeTravel,
    );
  }
}
