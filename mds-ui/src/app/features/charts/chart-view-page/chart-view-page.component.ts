import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
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
  CompiledTable,
  Explore,
  FieldId,
  MetricQuery,
  QueryResults,
  getFieldId,
} from '../../../core/models/explore.model';
import { ChartService } from '../chart.service';
import { ExplorerService } from '../../explorer/explorer.service';
import {
  clampQueryLimit,
  resolveMaxQueryLimit,
} from '../../explorer/query-limit.utils';
import { ChartVisualizationComponent } from '../chart-visualization/chart-visualization.component';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { AppStateService } from '../../../core/services/app-state.service';
import { SqlHighlightComponent } from '../../../shared/sql-highlight/sql-highlight.component';
import { TablesChartConfigPanelComponent } from '../../explorer/tables-chart-config-panel/tables-chart-config-panel.component';
import { TablesChartDisplayConfig } from '../../explorer/tables-chart-config-panel/tables-chart-config.constants';

type ChartViewMode = 'chart' | 'sql';

type TableFieldGroup = {
  table: CompiledTable;
  dimensions: { fieldId: FieldId; label: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

@Component({
  selector: 'app-chart-view-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ChartVisualizationComponent,
    TablesChartConfigPanelComponent,
    ResizableSidebarDirective,
    SqlHighlightComponent,
  ],
  templateUrl: './chart-view-page.component.html',
  styleUrl: './chart-view-page.component.scss',
})
export class ChartViewPageComponent {
  private readonly chartService = inject(ChartService);
  private readonly explorerService = inject(ExplorerService);
  private readonly route = inject(ActivatedRoute);
  private readonly appState = inject(AppStateService);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly chartUuid = signal<string | null>(null);
  protected readonly chart = signal<SavedChart | null>(null);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

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
  protected readonly chartDisplayConfig = computed(
    () => this.panelView().displayConfig as TablesChartDisplayConfig,
  );
  protected readonly selectedDimensions = signal<Set<FieldId>>(new Set());
  protected readonly selectedMetrics = signal<Set<FieldId>>(new Set());
  protected readonly additionalMetrics = signal<AdditionalMetric[]>([]);
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly saveLoading = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly saveSuccess = signal(false);

  protected readonly maxQueryLimit = computed(() =>
    resolveMaxQueryLimit(this.appState.health()?.query?.maxLimit),
  );

  protected readonly viewMode = signal<ChartViewMode>('chart');
  protected readonly compiledSql = computed(
    () => this.queryResults()?.compiledSql?.trim() || null,
  );

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
        })),
      metrics: Object.values(table.metrics)
        .filter((metric) => !metric.hidden)
        .map((metric) => ({
          fieldId: getFieldId(table.name, metric.name),
          label: metric.label,
        })),
    }));
  });

  protected readonly selectedDimensionList = computed(() =>
    Array.from(this.selectedDimensions()),
  );

  protected readonly selectedMetricList = computed(() =>
    Array.from(this.selectedMetrics()),
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

  protected readonly canSave = computed(
    () =>
      !!this.chart() &&
      !!this.explore() &&
      this.canRenderChart() &&
      !this.queryLoading() &&
      !this.saveLoading(),
  );

  protected readonly getFieldLabelFn = (fieldId: FieldId): string =>
    this.getFieldLabel(fieldId);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const chartUuid = params.get('chartUuid');

      if (!projectUuid || !chartUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.chartUuid.set(chartUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadChart(projectUuid, chartUuid);
    });
  }

  private loadChart(projectUuid: string, chartUuid: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.queryResults.set(null);
    this.queryError.set(null);

    this.chartService.get(projectUuid, chartUuid).subscribe({
      next: (chart) => {
        this.chart.set(chart);
        this.applySavedChartConfig(chart);
        this.applyMetricQuery(chart.metricQuery);
        this.loading.set(false);
        this.loadExplore(projectUuid, chart.tableName);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Failed to load chart.'));
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

  private loadExplore(projectUuid: string, tableName: string): void {
    this.explorerService.getExplore(projectUuid, tableName).subscribe({
      next: (explore) => {
        this.explore.set(explore);
        this.runQuery();
      },
      error: (err) => {
        this.queryError.set(apiErrorMessage(err, 'Failed to load explore fields.'));
      },
    });
  }

  private applyMetricQuery(metricQuery: MetricQuery): void {
    this.selectedDimensions.set(new Set(metricQuery.dimensions));
    this.selectedMetrics.set(new Set(metricQuery.metrics));
    this.additionalMetrics.set(metricQuery.additionalMetrics);
    this.syncChartAxisFields();
  }

  protected isDimensionSelected(fieldId: FieldId): boolean {
    return this.selectedDimensions().has(fieldId);
  }

  protected isMetricSelected(fieldId: FieldId): boolean {
    return this.selectedMetrics().has(fieldId);
  }

  protected toggleDimension(fieldId: FieldId): void {
    const next = new Set(this.selectedDimensions());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedDimensions.set(next);
    this.syncChartAxisFields();
    this.runQuery();
  }

  protected toggleMetric(fieldId: FieldId): void {
    const next = new Set(this.selectedMetrics());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedMetrics.set(next);
    this.syncChartAxisFields();
    this.runQuery();
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
    const previousKind = this.chartKind();
    const result = applyChartKindChange(
      this.chartConfig(),
      this.cachedChartConfigs(),
      kind,
    );
    this.chartConfig.set(result.chartConfig);
    this.cachedChartConfigs.set(result.cache);

    if (kind === 'big_number') {
      this.ensureBigNumberMetric();
    } else if (previousKind === 'big_number') {
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
    const prevLimit = this.chartDisplayConfig().rowLimit;
    const next = {
      ...config,
      rowLimit: clampQueryLimit(config.rowLimit, this.maxQueryLimit()),
    };
    this.chartConfig.set(applyChartPanelPatch(this.chartConfig(), next));
    if (next.rowLimit !== prevLimit) {
      this.runQuery();
    }
  }

  protected setViewMode(mode: ChartViewMode): void {
    this.viewMode.set(mode);
  }

  protected saveChart(): void {
    const projectUuid = this.projectUuid();
    const chartUuid = this.chartUuid();
    const chart = this.chart();
    const explore = this.explore();

    if (!projectUuid || !chartUuid || !chart || !explore || !this.canSave()) {
      return;
    }

    this.saveLoading.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    this.chartService
      .update(projectUuid, chartUuid, {
        chartKind: chartKindFromConfig(this.chartConfig()),
        tableName: explore.name,
        metricQuery: {
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
        },
        chartConfig: this.chartConfig(),
      })
      .subscribe({
        next: (updated) => {
          this.chart.set(updated);
          this.saveLoading.set(false);
          this.saveSuccess.set(true);
        },
        error: (err) => {
          this.saveError.set(apiErrorMessage(err, 'Failed to save chart.'));
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
    } = {};

    if (kind !== 'big_number') {
      if (!currentX || !dimensions.includes(currentX)) {
        patch.xField = dimensions[0] ?? null;
      }
    }

    const validY = currentY.filter((fieldId) => metrics.includes(fieldId));
    if (validY.length === 0) {
      patch.yFields = metrics[0] ? [metrics[0]] : [];
    } else if (kind === 'big_number') {
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
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();

    if (!projectUuid || !explore || (dimensions.length === 0 && metrics.length === 0)) {
      this.queryResults.set(null);
      return;
    }

    this.queryLoading.set(true);
    this.queryError.set(null);

    this.explorerService
      .runQuery(projectUuid, {
        exploreName: explore.name,
        dimensions,
        metrics,
        filters: {},
        sorts: [],
        limit: clampQueryLimit(
          this.chartDisplayConfig().rowLimit,
          this.maxQueryLimit(),
        ),
        tableCalculations: [],
        additionalMetrics: this.additionalMetrics(),
      })
      .subscribe({
        next: (results) => {
          this.queryResults.set(results);
          this.queryLoading.set(false);
        },
        error: (err) => {
          this.queryError.set(apiErrorMessage(err, 'Failed to run query.'));
          this.queryLoading.set(false);
        },
      });
  }
}
