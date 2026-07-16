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
import { ChartKind } from '../../../core/models/chart.model';
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

const CHART_COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272'];

const CHART_LAYOUT_PADDING = { top: 8, right: 8, bottom: 8, left: 8 };

const CHART_BASE_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: CHART_LAYOUT_PADDING },
} as const;

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

    const config = this.buildChartConfig(kind, labels, values, results, xFieldId, yFieldId);
    this.destroyChart();
    this.chart = new Chart(canvas, config);
  }

  private buildChartConfig(
    kind: ChartKind,
    labels: string[],
    values: number[],
    results: QueryResults,
    xFieldId: FieldId,
    yFieldId: FieldId,
  ): ChartConfiguration {
    const xLabel = results.fields[xFieldId]?.label ?? xFieldId;
    const yLabel = results.fields[yFieldId]?.label ?? yFieldId;

    if (kind === 'pie') {
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
          ...CHART_BASE_OPTIONS,
          plugins: {
            legend: {
              position: 'right',
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

    return {
      type: chartType,
      data: {
        labels,
        datasets: [
          {
            label: yLabel,
            data: values,
            backgroundColor:
              chartType === 'bar' ? 'rgba(34, 139, 230, 0.75)' : 'rgba(34, 139, 230, 0.15)',
            borderColor: '#228be6',
            borderWidth: chartType === 'line' ? 2 : 1,
            borderRadius: chartType === 'bar' ? 4 : 0,
            tension: 0.3,
            fill: chartType === 'line',
            pointRadius: chartType === 'line' ? 3 : 0,
            pointBackgroundColor: '#228be6',
          },
        ],
      },
      options: {
        ...CHART_BASE_OPTIONS,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#212529',
            titleFont: { size: 12 },
            bodyFont: { size: 12 },
            padding: 10,
          },
        },
        datasets: {
          bar: {
            barPercentage: 0.85,
            categoryPercentage: 0.9,
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#868e96', font: { size: 11 } },
            title: {
              display: !horizontal,
              text: xLabel,
              color: '#495057',
              font: { size: 12, weight: 500 },
            },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { color: '#868e96', font: { size: 11 } },
            title: {
              display: true,
              text: horizontal ? xLabel : yLabel,
              color: '#495057',
              font: { size: 12, weight: 500 },
            },
            beginAtZero: true,
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
