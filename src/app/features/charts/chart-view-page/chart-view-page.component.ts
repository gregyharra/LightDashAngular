import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ChartKind, SavedChart } from '../../../core/models/chart.model';
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

type ChartViewMode = 'chart' | 'sql';

type TableFieldGroup = {
  table: CompiledTable;
  dimensions: { fieldId: FieldId; label: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

const CHART_TYPE_OPTIONS: { value: ChartKind; label: string; icon: string }[] = [
  { value: 'vertical_bar', label: 'Bar', icon: 'bar_chart' },
  { value: 'horizontal_bar', label: 'H. bar', icon: 'align_horizontal_left' },
  { value: 'line', label: 'Line', icon: 'show_chart' },
  { value: 'pie', label: 'Pie', icon: 'pie_chart' },
  { value: 'table', label: 'Table', icon: 'table_rows' },
];

@Component({
  selector: 'app-chart-view-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ChartVisualizationComponent,
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

  protected readonly chartTypeOptions = CHART_TYPE_OPTIONS;

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly chartUuid = signal<string | null>(null);
  protected readonly chart = signal<SavedChart | null>(null);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly chartKind = signal<ChartKind>('vertical_bar');
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

  protected readonly xField = computed(() => this.selectedDimensionList()[0] ?? null);
  protected readonly yField = computed(() => this.selectedMetricList()[0] ?? null);

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
        this.chartKind.set(chart.chartConfig.type);
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
    this.runQuery();
  }

  protected removeDimension(fieldId: FieldId): void {
    const next = new Set(this.selectedDimensions());
    next.delete(fieldId);
    this.selectedDimensions.set(next);
    this.runQuery();
  }

  protected removeMetric(fieldId: FieldId): void {
    const next = new Set(this.selectedMetrics());
    next.delete(fieldId);
    this.selectedMetrics.set(next);
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
    this.chartKind.set(kind);
  }

  protected setViewMode(mode: ChartViewMode): void {
    this.viewMode.set(mode);
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
        limit: 500,
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
