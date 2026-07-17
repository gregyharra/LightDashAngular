import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import {
  ChartDisplayConfig,
  ChartKind,
  DEFAULT_CHART_DISPLAY_CONFIG,
  SavedChart,
} from '../../../core/models/chart.model';
import {
  CompiledTable,
  Explore,
  FieldId,
  MetricQuery,
  QueryResults,
  getFieldId,
} from '../../../core/models/explore.model';
import { ChartService } from '../chart.service';
import { ExplorerService } from '../../explorer/explorer.service';
import { ChartVisualizationComponent } from '../chart-visualization/chart-visualization.component';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { SqlRunnerPanelComponent } from '../../sql-runner/sql-runner-panel/sql-runner-panel.component';
import { defaultSampleSql } from '../../../core/mock/fixtures/sql-runner.fixture';
import { TablesChartConfigPanelComponent } from '../../explorer/tables-chart-config-panel/tables-chart-config-panel.component';

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
    SqlRunnerPanelComponent,
  ],
  templateUrl: './chart-view-page.component.html',
  styleUrl: './chart-view-page.component.scss',
})
export class ChartViewPageComponent {
  private readonly chartService = inject(ChartService);
  private readonly explorerService = inject(ExplorerService);
  private readonly route = inject(ActivatedRoute);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly chartUuid = signal<string | null>(null);
  protected readonly chart = signal<SavedChart | null>(null);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly chartKind = signal<ChartKind>('vertical_bar');
  protected readonly chartXField = signal<FieldId | null>(null);
  protected readonly chartYFields = signal<FieldId[]>([]);
  protected readonly chartDisplayConfig = signal<ChartDisplayConfig>(
    DEFAULT_CHART_DISPLAY_CONFIG,
  );
  protected readonly selectedDimensions = signal<Set<FieldId>>(new Set());
  protected readonly selectedMetrics = signal<Set<FieldId>>(new Set());
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);

  protected readonly viewMode = signal<ChartViewMode>('chart');
  protected readonly sampleSql = defaultSampleSql;

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
      error: () => {
        this.error.set('Failed to load chart.');
        this.loading.set(false);
      },
    });
  }

  private applySavedChartConfig(chart: SavedChart): void {
    const { chartConfig } = chart;
    this.chartKind.set(chartConfig.type);

    const xField =
      chartConfig.xField ?? chart.metricQuery.dimensions[0] ?? null;
    const yFields =
      chartConfig.yFields ??
      (chartConfig.yField
        ? [chartConfig.yField]
        : chart.metricQuery.metrics[0]
          ? [chart.metricQuery.metrics[0]]
          : []);

    this.chartXField.set(xField);
    this.chartYFields.set(yFields);
    this.chartDisplayConfig.set({
      ...DEFAULT_CHART_DISPLAY_CONFIG,
      ...chartConfig.displayConfig,
      flipAxes: chartConfig.type === 'horizontal_bar',
    });
  }

  private loadExplore(projectUuid: string, tableName: string): void {
    this.explorerService.getExplore(projectUuid, tableName).subscribe({
      next: (explore) => {
        this.explore.set(explore);
        this.runQuery();
      },
      error: () => {
        this.queryError.set('Failed to load explore fields.');
      },
    });
  }

  private applyMetricQuery(metricQuery: MetricQuery): void {
    this.selectedDimensions.set(new Set(metricQuery.dimensions));
    this.selectedMetrics.set(new Set(metricQuery.metrics));
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

    return fieldId;
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

  protected setChartDisplayConfig(config: ChartDisplayConfig): void {
    const prevLimit = this.chartDisplayConfig().rowLimit;
    this.chartDisplayConfig.set(config);
    if (config.flipAxes && this.chartKind() === 'vertical_bar') {
      this.chartKind.set('horizontal_bar');
    } else if (!config.flipAxes && this.chartKind() === 'horizontal_bar') {
      this.chartKind.set('vertical_bar');
    }
    if (config.rowLimit !== prevLimit) {
      this.runQuery();
    }
  }

  protected setViewMode(mode: ChartViewMode): void {
    this.viewMode.set(mode);
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
        limit: this.chartDisplayConfig().rowLimit,
        tableCalculations: [],
        additionalMetrics: [],
      })
      .subscribe({
        next: (results) => {
          this.queryResults.set(results);
          this.queryLoading.set(false);
        },
        error: () => {
          this.queryError.set('Failed to run query.');
          this.queryLoading.set(false);
        },
      });
  }
}
