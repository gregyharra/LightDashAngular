import { EChartsOption, SeriesOption } from 'echarts';
import {
  CartesianChartConfigBody,
  ChartKind,
  ChartLegendPlacement,
} from '../../../core/models/chart.model';
import { FieldId, QueryResults } from '../../../core/models/explore.model';

const SERIES_COLORS = ['#7262ff', '#e67700', '#12b886'];

const DEFAULT_COLOR_BY_KIND: Record<BuildCartesianArgs['chartKind'], string> = {
  vertical_bar: '#7262ff',
  line: '#e67700',
  horizontal_bar: '#12b886',
};

export type BuildCartesianArgs = {
  results: QueryResults;
  config: CartesianChartConfigBody;
  chartKind: Extract<ChartKind, 'vertical_bar' | 'horizontal_bar' | 'line'>;
  dashboardMode?: boolean;
};

function toNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }

  return Number(raw) || 0;
}

function fieldLabel(results: QueryResults, fieldId: FieldId): string {
  return results.fields[fieldId]?.label ?? fieldId;
}

function buildLegend(
  show: boolean,
  placement: ChartLegendPlacement,
): EChartsOption['legend'] {
  if (placement === 'outside-left') {
    return { show, left: 'left', top: 'middle', orient: 'vertical' };
  }

  if (placement === 'outside-right') {
    return { show, right: 'right', top: 'middle', orient: 'vertical' };
  }

  return { show, left: 'center', top: 'top', orient: 'horizontal' };
}

export function buildCartesianOption({
  results,
  config,
  chartKind,
  dashboardMode = false,
}: BuildCartesianArgs): EChartsOption | null {
  const { xField, yFields } = config.layout;
  if (!xField || !yFields?.length || results.rows.length === 0) {
    return null;
  }

  const horizontal = config.layout.flipAxes || chartKind === 'horizontal_bar';
  const stacked =
    config.layout.stackMode === 'stack' ||
    config.layout.stackMode === 'percent';
  const labels = results.rows.map((row) => row[xField]?.value.formatted ?? '');
  const seriesType = chartKind === 'line' ? 'line' : 'bar';
  const defaultColor = DEFAULT_COLOR_BY_KIND[chartKind];

  const series: SeriesOption[] = yFields.map((fieldId, index) => {
    const color =
      index === 0 && config.seriesColor
        ? config.seriesColor
        : index === 0
          ? defaultColor
          : SERIES_COLORS[index % SERIES_COLORS.length];
    const base = {
      name: fieldLabel(results, fieldId),
      type: seriesType,
      data: results.rows.map((row) => toNumber(row[fieldId]?.value.raw)),
      stack: stacked ? 'stack' : undefined,
      label: { show: config.showValueLabels ?? false },
      itemStyle: { color },
    } as const;

    if (seriesType === 'line') {
      return {
        ...base,
        lineStyle: { color, width: 2 },
        symbolSize: 8,
      };
    }

    return base;
  });

  const dimensionLabel = fieldLabel(results, xField);
  const metricLabel = fieldLabel(results, yFields[0]);
  const xAxisName = dashboardMode
    ? undefined
    : config.layout.xAxisLabel || (horizontal ? metricLabel : dimensionLabel);
  const yAxisName = dashboardMode
    ? undefined
    : config.layout.yAxisLabel || (horizontal ? dimensionLabel : metricLabel);
  const valueAxisMax = config.layout.stackMode === 'percent' ? 100 : undefined;

  return {
    color: SERIES_COLORS,
    grid: {
      ...config.margins,
      containLabel: true,
    },
    legend: buildLegend(config.showLegend, config.legendPlacement),
    tooltip: { trigger: 'axis' },
    xAxis: horizontal
      ? {
          type: 'value',
          name: xAxisName,
          show: config.layout.showXAxis,
          max: valueAxisMax,
          splitLine: { show: config.layout.showGridX },
        }
      : {
          type: 'category',
          name: xAxisName,
          show: config.layout.showXAxis,
          data: labels,
          splitLine: { show: config.layout.showGridX },
          axisLabel: { rotate: dashboardMode ? 45 : 0 },
        },
    yAxis: horizontal
      ? {
          type: 'category',
          name: yAxisName,
          show: config.layout.showYAxis,
          data: labels,
          splitLine: { show: config.layout.showGridY },
        }
      : {
          type: 'value',
          name: yAxisName,
          show: config.layout.showYAxis,
          max: valueAxisMax,
          splitLine: { show: config.layout.showGridY },
        },
    series,
  };
}
