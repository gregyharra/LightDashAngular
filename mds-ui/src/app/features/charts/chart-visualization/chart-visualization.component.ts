import { Component, computed, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { EChartsOption } from 'echarts';
import {
  BigNumberComparison,
  ChartConfig,
} from '../../../core/models/chart.model';
import { chartKindFromConfig } from '../../../core/models/chart-config.utils';
import { FieldId, QueryResults } from '../../../core/models/explore.model';
import { buildCartesianOption } from '../echarts/build-cartesian-option';
import { buildFunnelOption } from '../echarts/build-funnel-option';
import { buildPieOption } from '../echarts/build-pie-option';
import { buildGaugeOption } from '../echarts/build-gauge-option';
import { buildSankeyOption } from '../echarts/build-sankey-option';
import { buildTreemapOption } from '../echarts/build-treemap-option';
import { EchartHostComponent } from '../echarts/echart-host.component';

@Component({
  selector: 'app-chart-visualization',
  imports: [MatTableModule, EchartHostComponent],
  templateUrl: './chart-visualization.component.html',
  styleUrl: './chart-visualization.component.scss',
})
export class ChartVisualizationComponent {
  readonly chartConfig = input.required<ChartConfig>();
  readonly queryResults = input<QueryResults | null>(null);
  readonly dashboardMode = input(false);
  readonly bigNumberComparison = input<BigNumberComparison | null>(null);
  readonly unknownTypeNotice = input(false);

  protected readonly chartKind = computed(() =>
    chartKindFromConfig(this.chartConfig()),
  );

  protected readonly echartsOption = computed<EChartsOption | null>(() => {
    const results = this.queryResults();
    const config = this.chartConfig();
    if (!results || results.rows.length === 0) {
      return null;
    }

    try {
      if (config.type === 'cartesian') {
        const kind = chartKindFromConfig(config);
        if (
          kind !== 'vertical_bar' &&
          kind !== 'horizontal_bar' &&
          kind !== 'line' &&
          kind !== 'area' &&
          kind !== 'scatter'
        ) {
          return null;
        }
        return buildCartesianOption({
          results,
          config: config.config,
          chartKind: kind,
          dashboardMode: this.dashboardMode(),
        });
      }

      if (config.type === 'pie') {
        return buildPieOption({
          results,
          config: config.config,
          dashboardMode: this.dashboardMode(),
        });
      }

      if (config.type === 'funnel') {
        return buildFunnelOption({
          results,
          config: config.config,
          dashboardMode: this.dashboardMode(),
        });
      }

      if (config.type === 'treemap') {
        return buildTreemapOption({
          results,
          config: config.config,
          dashboardMode: this.dashboardMode(),
        });
      }

      if (config.type === 'gauge') {
        return buildGaugeOption({
          results,
          config: config.config,
          dashboardMode: this.dashboardMode(),
        });
      }

      if (config.type === 'sankey') {
        return buildSankeyOption({
          results,
          config: config.config,
          dashboardMode: this.dashboardMode(),
        });
      }
    } catch {
      return null;
    }

    return null;
  });

  protected readonly displayedColumns = computed(() => {
    const results = this.queryResults();
    if (!results || this.chartKind() !== 'table') {
      return [] as string[];
    }
    return Object.keys(results.fields);
  });

  protected readonly tableRows = computed(() => {
    const results = this.queryResults();
    if (!results || this.chartKind() !== 'table') {
      return [] as Record<string, string>[];
    }
    return results.rows.map((row) => {
      const flat: Record<string, string> = {};
      for (const [fieldId, cell] of Object.entries(row)) {
        flat[fieldId] = cell.value.formatted;
      }
      return flat;
    });
  });

  protected readonly bigNumberMetricField = computed(() => {
    const config = this.chartConfig();
    const results = this.queryResults();
    if (config.type === 'big_number' && config.config.selectedField) {
      return config.config.selectedField;
    }
    return results ? this.inferMetricField(results) : null;
  });

  protected readonly bigNumberValue = computed(() => {
    const results = this.queryResults();
    const fieldId = this.bigNumberMetricField();
    if (!results || results.rows.length === 0 || !fieldId) {
      return null;
    }
    return results.rows[0][fieldId]?.value.formatted ?? null;
  });

  protected readonly bigNumberLabel = computed(() => {
    const results = this.queryResults();
    const fieldId = this.bigNumberMetricField();
    if (!results || !fieldId) {
      return null;
    }
    return results.fields[fieldId]?.label ?? fieldId;
  });

  protected getColumnLabel(fieldId: string): string {
    const results = this.queryResults();
    return results?.fields[fieldId]?.label ?? fieldId;
  }

  private inferMetricField(results: QueryResults): FieldId | null {
    const fieldIds = Object.keys(results.fields);
    return (
      fieldIds.find((id) => results.fields[id]?.fieldType === 'metric') ??
      fieldIds[1] ??
      null
    );
  }
}
