import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { DashboardDimensionFilter } from '../../../core/models/dashboard.model';
import { DbtTreeNode } from '../../../core/models/lineage.model';
import { ChartConfig, ChartKind } from '../../../core/models/chart.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { queryErrorWarning } from '../../../core/api/api-error.service';
import {
  CompiledTable,
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
import { TablesFieldsPanelComponent } from '../tables-fields-panel/tables-fields-panel.component';
import { ChartVisualizationComponent } from '../../charts/chart-visualization/chart-visualization.component';
import { TablesChartConfigPanelComponent } from '../tables-chart-config-panel/tables-chart-config-panel.component';
import {
  DEFAULT_CHART_DISPLAY_CONFIG,
  TablesChartDisplayConfig,
} from '../tables-chart-config-panel/tables-chart-config.constants';
import {
  findExploreByName,
  findExploreForLineageNode,
} from '../explore-lineage.utils';
import {
  exploreHasFields,
  isExploreableDbtTreeNode,
  resolveExploreNameForSelection,
} from '../explore-from-dbt.utils';
import { buildMetricQuerySql } from '../metric-query-sql.utils';
import { ExplorerService } from '../explorer.service';
import { mergeDashboardFiltersIntoMetricQuery } from '../../dashboards/dashboard-filters';
import { mergeTimeTravelIntoMetricQuery } from '../time-travel.utils';
import { getFilterableDimensions } from '../tables-filters-panel/tables-filters.utils';
import { TablesFiltersPanelComponent } from '../tables-filters-panel/tables-filters-panel.component';
import { TimeTravelControlComponent } from '../../../shared/time-travel-control/time-travel-control.component';
import { QueryWarningsBannerComponent } from '../../../shared/query-warnings-banner/query-warnings-banner.component';
import { SqlHighlightComponent } from '../../../shared/sql-highlight/sql-highlight.component';
import { ChartService } from '../../charts/chart.service';
import {
  SaveChartDialogComponent,
  SaveChartDialogResult,
} from '../../charts/save-chart-dialog/save-chart-dialog.component';

type TableFieldGroup = {
  table: CompiledTable;
  dimensions: { fieldId: FieldId; label: string; type: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

@Component({
  selector: 'app-tables-workspace-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    FolderSearchPanelComponent,
    TablesFieldsPanelComponent,
    TablesChartConfigPanelComponent,
    ChartVisualizationComponent,
    TablesFiltersPanelComponent,
    TimeTravelControlComponent,
    QueryWarningsBannerComponent,
    SqlHighlightComponent,
    ResizableSidebarDirective,
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
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly tableId = signal<string | null>(null);
  protected readonly dbtTree = signal<DbtTreeNode[]>([]);
  protected readonly explores = signal<ExploreSummary[]>([]);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly listLoading = signal(true);
  protected readonly exploreLoading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly exploreError = signal<string | null>(null);

  protected readonly fieldSearch = signal('');
  protected readonly selectedFields = signal<Set<FieldId>>(new Set());
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly hasRunQuery = signal(false);
  protected readonly chartKind = signal<ChartKind>('vertical_bar');
  protected readonly chartXField = signal<FieldId | null>(null);
  protected readonly chartYFields = signal<FieldId[]>([]);
  protected readonly chartDisplayConfig = signal<TablesChartDisplayConfig>(
    DEFAULT_CHART_DISPLAY_CONFIG,
  );
  protected readonly chartConfigOpen = signal(false);
  protected readonly dimensionFilters = signal<DashboardDimensionFilter[]>([]);
  protected readonly timeTravel = signal<TimeTravelConfig | null>(null);
  protected readonly queryWarnings = signal<QueryWarning[]>([]);
  protected readonly saveChartLoading = signal(false);

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

  protected readonly tableGroups = computed<TableFieldGroup[]>(() => {
    const explore = this.explore();
    if (!explore) {
      return [];
    }

    return Object.values(explore.tables).map((table) => ({
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

    if (kind === 'big_number') {
      return this.chartYFields().length > 0;
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
      500,
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
  }

  private loadWorkspaceData(
    projectUuid: string,
    tableId: string | null,
  ): void {
    this.listLoading.set(true);
    this.listError.set(null);

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
        this.listError.set(apiErrorMessage(err, 'Failed to load project tree.'));
        this.listLoading.set(false);
      },
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
        this.exploreError.set('Unable to load fields for this model.');
      }
      return;
    }

    this.explorerService
      .getExplore(projectUuid, exploreName)
      .subscribe({
        next: (explore) => {
          if (!exploreHasFields(explore)) {
            this.explore.set(null);
            this.exploreError.set('Unable to load fields for this model.');
          } else {
            this.explore.set(explore);
            this.exploreError.set(null);
            this.setDefaultSelection(explore);
          }
          this.exploreLoading.set(false);
        },
        error: (err) => {
          this.exploreError.set(apiErrorMessage(err, 'Failed to load table.'));
          this.exploreLoading.set(false);
        },
      });
  }

  private resetQueryState(): void {
    this.selectedFields.set(new Set());
    this.queryResults.set(null);
    this.queryError.set(null);
    this.hasRunQuery.set(false);
    this.fieldSearch.set('');
    this.chartKind.set('vertical_bar');
    this.chartXField.set(null);
    this.chartYFields.set([]);
    this.chartDisplayConfig.set(DEFAULT_CHART_DISPLAY_CONFIG);
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
    const previousKind = this.chartKind();
    this.chartKind.set(kind);
    if (kind === 'horizontal_bar') {
      this.chartDisplayConfig.update((config) => ({ ...config, flipAxes: true }));
    } else if (kind === 'vertical_bar') {
      this.chartDisplayConfig.update((config) => ({ ...config, flipAxes: false }));
    }

    if (kind === 'big_number') {
      this.ensureBigNumberMetric();
    } else if (previousKind === 'big_number') {
      this.syncChartAxisFields();
    }
  }

  protected setChartXField(fieldId: FieldId): void {
    this.chartXField.set(fieldId);
  }

  protected setChartYFields(fieldIds: FieldId[]): void {
    this.chartYFields.set(fieldIds);
  }

  protected setChartDisplayConfig(config: TablesChartDisplayConfig): void {
    this.chartDisplayConfig.set(config);
    if (config.flipAxes && this.chartKind() === 'vertical_bar') {
      this.chartKind.set('horizontal_bar');
    } else if (!config.flipAxes && this.chartKind() === 'horizontal_bar') {
      this.chartKind.set('vertical_bar');
    }
  }

  protected toggleChartConfig(event: Event): void {
    event.stopPropagation();
    this.chartConfigOpen.update((open) => !open);
  }

  private syncChartAxisFields(): void {
    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();
    const currentX = this.chartXField();
    const currentY = this.chartYFields();
    const kind = this.chartKind();

    if (kind !== 'big_number') {
      if (!currentX || !dimensions.includes(currentX)) {
        this.chartXField.set(dimensions[0] ?? null);
      }
    }

    const validY = currentY.filter((fieldId) => metrics.includes(fieldId));
    if (validY.length === 0) {
      this.chartYFields.set(metrics[0] ? [metrics[0]] : []);
    } else if (kind === 'big_number') {
      this.chartYFields.set([validY[0]]);
    } else {
      this.chartYFields.set(validY);
    }
  }

  private ensureBigNumberMetric(): void {
    const metrics = this.selectedMetricList();
    const currentY = this.chartYFields().filter((fieldId) => metrics.includes(fieldId));
    if (currentY.length === 0) {
      this.chartYFields.set(metrics[0] ? [metrics[0]] : []);
    } else {
      this.chartYFields.set([currentY[0]]);
    }
  }

  protected isMetricField(fieldId: FieldId): boolean {
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
    return this.columnLabels()[fieldId] || fieldId;
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
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    const selected = this.selectedFieldList();

    if (!projectUuid || !explore || selected.length === 0) {
      return;
    }

    this.queryLoading.set(true);
    this.queryError.set(null);
    this.queryWarnings.set([]);
    this.hasRunQuery.set(true);

    const timeTravel = this.resolveTimeTravelForQuery();

    this.explorerService
      .runQuery(projectUuid, this.buildCurrentMetricQuery(timeTravel))
      .subscribe({
        next: (results) => {
          this.queryResults.set(results);
          this.queryWarnings.set(results.warnings ?? []);
          this.queryLoading.set(false);
        },
        error: (err) => {
          this.queryWarnings.set([queryErrorWarning(err)]);
          this.queryError.set(null);
          this.queryLoading.set(false);
        },
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
          chartKind: this.chartKind(),
          metricQuery: this.buildCurrentMetricQuery(this.resolveTimeTravelForQuery()),
          chartConfig: this.buildCurrentChartConfig(),
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

    return mergeTimeTravelIntoMetricQuery(
      mergeDashboardFiltersIntoMetricQuery(
        {
          exploreName: explore!.name,
          dimensions,
          metrics,
          filters: {},
          sorts: [],
          limit: 500,
          tableCalculations: [],
          additionalMetrics: [],
        },
        this.dimensionFilters(),
      ),
      timeTravel,
    );
  }

  private buildCurrentChartConfig(): ChartConfig {
    const yFields = this.chartYFields();

    return {
      type: this.chartKind(),
      xField: this.chartXField() ?? undefined,
      yField: yFields[0] ?? undefined,
      yFields,
      displayConfig: this.chartDisplayConfig(),
    };
  }
}
