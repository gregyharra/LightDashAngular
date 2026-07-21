import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
} from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js';
import { MatTableModule } from '@angular/material/table';
import {
  BigNumberComparison,
  ChartKind,
  ChartDisplayConfig,
  DEFAULT_CHART_DISPLAY_CONFIG,
} from '../../../core/models/chart.model';
import { FieldId, QueryResults } from '../../../core/models/explore.model';

Chart.register(
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  ArcElement,
  DoughnutController,
  Legend,
  Tooltip,
);

const CHART_COLORS = ['#7262ff', '#5c7cfa', '#22b8cf', '#fab005', '#fd7e14', '#e64980'];
const LD_PURPLE = '#7262ff';
const LD_ORANGE = '#e67700';
const LD_TEAL = '#12b886';

let activeValueLabelsConfig: ChartDisplayConfig | undefined;

const valueLabelsPlugin = {
  id: 'valueLabels',
  afterDatasetsDraw(chart: Chart) {
    const displayConfig = activeValueLabelsConfig;

    if (!displayConfig?.showValueLabels) {
      return;
    }

    const chartType = (chart.config as ChartConfiguration).type;
    const { ctx } = chart;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta.visible) {
        return;
      }

      meta.data.forEach((element, index) => {
        const raw = dataset.data[index];
        const value = typeof raw === 'number' ? raw : Number(raw) || 0;
        const label =
          value >= 1000
            ? value >= 100000
              ? `$${(value / 1000).toFixed(0)}K`
              : value >= 10000
                ? `${(value / 1000).toFixed(1)}K`
                : value >= 1000
                  ? `${(value / 1000).toFixed(2)}K`
                  : chartType === 'line'
                    ? `$${value.toFixed(0)}`
                    : String(Math.round(value))
            : chartType === 'line'
              ? value < 10
                ? value.toFixed(2)
                : `$${value.toFixed(0)}`
              : String(Math.round(value));

        const position = element.tooltipPosition(false);
        const x = position.x ?? 0;
        const y = (position.y ?? 0) - 6;
        ctx.save();
        ctx.fillStyle = '#495057';
        ctx.font = '11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(label, x, y);
        ctx.restore();
      });
    });
  },
};

Chart.register(valueLabelsPlugin);

@Component({
  selector: 'app-chart-visualization',
  imports: [MatTableModule],
  templateUrl: './chart-visualization.component.html',
  styleUrl: './chart-visualization.component.scss',
})
export class ChartVisualizationComponent implements AfterViewInit, OnDestroy
{
  readonly chartKind = input.required<ChartKind>();
  readonly queryResults = input<QueryResults | null>(null);
  readonly xField = input<FieldId | null>(null);
  readonly yField = input<FieldId | null>(null);
  readonly displayConfig = input<ChartDisplayConfig>(DEFAULT_CHART_DISPLAY_CONFIG);
  readonly dashboardMode = input(false);
  readonly bigNumberComparison = input<BigNumberComparison | null>(null);

  @ViewChild('chartCanvas') private chartCanvas?: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;
  private resizeObserver?: ResizeObserver;

  protected displayedColumns: string[] = [];
  protected tableRows: Record<string, string>[] = [];

  protected readonly bigNumberValue = computed(() => {
    const results = this.queryResults();
    if (!results || results.rows.length === 0) {
      return null;
    }

    const yFieldId = this.yField() ?? this.inferMetricField(results);
    if (!yFieldId) {
      return null;
    }

    return results.rows[0][yFieldId]?.value.formatted ?? null;
  });

  protected readonly bigNumberLabel = computed(() => {
    const results = this.queryResults();
    if (!results) {
      return null;
    }

    const yFieldId = this.yField() ?? this.inferMetricField(results);
    if (!yFieldId) {
      return null;
    }

    return results.fields[yFieldId]?.label ?? yFieldId;
  });

  constructor() {
    effect(() => {
      this.chartKind();
      this.queryResults();
      this.xField();
      this.yField();
      this.displayConfig();
      this.dashboardMode();
      this.bigNumberComparison();

      if (this.viewReady) {
        this.render();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.render();
    this.observeContainerResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.destroyChart();
  }

  private observeContainerResize(): void {
    const wrap = this.chartCanvas?.nativeElement?.parentElement;
    if (!wrap || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      if (this.chart) {
        this.chart.resize();
        return;
      }

      if (this.viewReady && this.queryResults()) {
        this.render();
      }
    });
    this.resizeObserver.observe(wrap);
  }

  private render(): void {
    if (!this.viewReady) {
      return;
    }

    const results = this.queryResults();
    const kind = this.chartKind();

    if (!results || results.rows.length === 0) {
      this.destroyChart();
      this.tableRows = [];
      return;
    }

    if (kind === 'table' || kind === 'big_number') {
      this.destroyChart();
      if (kind === 'table') {
        this.renderTable(results);
      }
      return;
    }

    this.updateTablePreview(results);
    this.renderChart(kind, results);
  }

  private renderTable(results: QueryResults): void {
    this.displayedColumns = Object.keys(results.fields);
    this.tableRows = results.rows.map((row) => {
      const flat: Record<string, string> = {};
      for (const [fieldId, cell] of Object.entries(row)) {
        flat[fieldId] = cell.value.formatted;
      }
      return flat;
    });
  }

  private updateTablePreview(results: QueryResults): void {
    this.displayedColumns = [];
    this.tableRows = [];
    void results;
  }

  private renderChart(kind: ChartKind, results: QueryResults): void {
    const canvas = this.chartCanvas?.nativeElement;
    if (!canvas) {
      return;
    }

    const xFieldId = this.xField() ?? this.inferDimensionField(results);
    const yFieldId = this.yField() ?? this.inferMetricField(results);

    if (!xFieldId || !yFieldId) {
      this.destroyChart();
      return;
    }

    const labels = results.rows.map(
      (row) => row[xFieldId]?.value.formatted ?? '',
    );
    const values = results.rows.map((row) => {
      const raw = row[yFieldId]?.value.raw;
      return typeof raw === 'number' ? raw : Number(raw) || 0;
    });

    const config = this.buildChartConfig(
      kind,
      labels,
      values,
      results,
      xFieldId,
      yFieldId,
      this.displayConfig(),
      this.dashboardMode(),
    );
    this.destroyChart();
    activeValueLabelsConfig = this.displayConfig();
    this.chart = new Chart(canvas, config);
  }

  private buildChartConfig(
    kind: ChartKind,
    labels: string[],
    values: number[],
    results: QueryResults,
    xFieldId: FieldId,
    yFieldId: FieldId,
    displayConfig: ChartDisplayConfig,
    dashboardMode: boolean,
  ): ChartConfiguration {
    const xLabel =
      displayConfig.xAxisLabel || (results.fields[xFieldId]?.label ?? xFieldId);
    const yLabel =
      displayConfig.yAxisLabel || (results.fields[yFieldId]?.label ?? yFieldId);
    const layoutPadding = displayConfig.margins;
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: layoutPadding },
    } as const;
    const seriesColor =
      displayConfig.seriesColor ??
      (kind === 'line' ? LD_ORANGE : kind === 'horizontal_bar' ? LD_TEAL : LD_PURPLE);

    if (kind === 'pie') {
      const legendPosition =
        displayConfig.legendPlacement === 'outside-left'
          ? 'left'
          : displayConfig.legendPlacement === 'outside-right'
            ? 'right'
            : 'bottom';

      return {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: labels.map(
                (_, index) => CHART_COLORS[index % CHART_COLORS.length],
              ),
              borderWidth: 1,
              borderColor: '#fff',
            },
          ],
        },
        options: {
          ...baseOptions,
          plugins: {
            legend: {
              display: displayConfig.showLegend,
              position: legendPosition,
              labels: {
                color: '#495057',
                font: { size: 12 },
                boxWidth: 12,
              },
            },
            tooltip: {
              backgroundColor: '#212529',
              titleFont: { size: 12 },
              bodyFont: { size: 12 },
              padding: 10,
            },
          },
        },
      };
    }

    const horizontal = kind === 'horizontal_bar';
    const chartType = kind === 'line' ? 'line' : 'bar';
    const categoryAxis = horizontal ? 'y' : 'x';
    const valueAxis = horizontal ? 'x' : 'y';
    const stackMode = displayConfig.stackMode;
    const stacked = stackMode === 'stack' || stackMode === 'percent';

    return {
      type: chartType,
      data: {
        labels,
        datasets: [
          {
            label: yLabel,
            data: values,
            backgroundColor:
              chartType === 'bar' ? seriesColor : `${seriesColor}26`,
            borderColor: seriesColor,
            borderWidth: chartType === 'line' ? 2 : 1,
            borderRadius: chartType === 'bar' ? 2 : 0,
            tension: 0.2,
            fill: false,
            pointRadius: chartType === 'line' ? 4 : 0,
            pointBackgroundColor: seriesColor,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            stack: stacked ? 'stack' : undefined,
          },
        ],
      },
      options: {
        ...baseOptions,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: {
            display: displayConfig.showLegend,
            position:
              displayConfig.legendPlacement === 'outside-left'
                ? 'left'
                : displayConfig.legendPlacement === 'outside-right'
                  ? 'right'
                  : 'top',
          },
          tooltip: {
            backgroundColor: '#212529',
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            padding: 10,
          },
        },
        datasets: {
          bar: {
            barPercentage: 0.75,
            categoryPercentage: 0.85,
          },
        },
        scales: {
          [categoryAxis]: {
            display: horizontal ? displayConfig.showYAxis : displayConfig.showXAxis,
            stacked,
            grid: {
              display: false,
              color: 'rgba(0,0,0,0.04)',
            },
            border: {
              display: false,
            },
            ticks: {
              color: '#868e96',
              font: { size: 11 },
              maxRotation: dashboardMode ? 45 : 0,
              minRotation: dashboardMode ? 45 : 0,
            },
            title: {
              display: !dashboardMode,
              text: horizontal ? yLabel : xLabel,
              color: '#495057',
              font: { size: 12, weight: 500 },
            },
          },
          [valueAxis]: {
            display: horizontal ? displayConfig.showXAxis : displayConfig.showYAxis,
            stacked,
            grid: {
              display: dashboardMode ? displayConfig.showGridY : displayConfig.showGridY,
              color: 'rgba(0,0,0,0.06)',
            },
            border: {
              display: false,
            },
            ticks: {
              color: '#868e96',
              font: { size: 11 },
              callback(tickValue) {
                const value = Number(tickValue);
                if (Number.isNaN(value)) {
                  return tickValue;
                }
                if (value >= 1000) {
                  return `$${Math.round(value / 1000)}K`;
                }
                return value;
              },
            },
            title: {
              display: !dashboardMode,
              text: horizontal ? xLabel : yLabel,
              color: '#495057',
              font: { size: 12, weight: 500 },
            },
            beginAtZero: true,
            ...(stackMode === 'percent' ? { max: 100 } : {}),
          },
        },
      },
    };
  }

  private inferDimensionField(results: QueryResults): FieldId | null {
    const fieldIds = Object.keys(results.fields);
    return (
      fieldIds.find(
        (id) => results.fields[id]?.fieldType === 'dimension',
      ) ?? fieldIds[0] ?? null
    );
  }

  private inferMetricField(results: QueryResults): FieldId | null {
    const fieldIds = Object.keys(results.fields);
    return (
      fieldIds.find((id) => results.fields[id]?.fieldType === 'metric') ??
      fieldIds[1] ??
      null
    );
  }

  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }

    const canvas = this.chartCanvas?.nativeElement;
    if (canvas) {
      canvas.removeAttribute('style');
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  protected getColumnLabel(fieldId: string): string {
    const results = this.queryResults();
    return results?.fields[fieldId]?.label ?? fieldId;
  }
}
