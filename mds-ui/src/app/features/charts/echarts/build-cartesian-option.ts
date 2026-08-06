import { EChartsOption, SeriesOption } from 'echarts';
import {
  CartesianChartConfigBody,
  CartesianSeriesType,
  ChartKind,
  ChartLegendPlacement,
} from '../../../core/models/chart.model';
import { FieldId, QueryResults } from '../../../core/models/explore.model';

const SERIES_COLORS = ['#7262ff', '#e67700', '#12b886', '#5c7cfa', '#fab005'];

type CartesianChartKind = Extract<
  ChartKind,
  'vertical_bar' | 'horizontal_bar' | 'line' | 'area' | 'scatter' | 'mixed'
>;

type ResolvedSeriesGeometry = CartesianSeriesType | 'scatter';

const DEFAULT_COLOR_BY_KIND: Record<CartesianChartKind, string> = {
  vertical_bar: '#7262ff',
  line: '#e67700',
  horizontal_bar: '#12b886',
  area: '#7262ff',
  scatter: '#7262ff',
  mixed: '#7262ff',
};

export type BuildCartesianArgs = {
  results: QueryResults;
  config: CartesianChartConfigBody;
  chartKind: CartesianChartKind;
  dashboardMode?: boolean;
};

function defaultSeriesGeometry(chartKind: CartesianChartKind): ResolvedSeriesGeometry {
  switch (chartKind) {
    case 'line':
      return 'line';
    case 'area':
      return 'area';
    case 'scatter':
      return 'scatter';
    case 'mixed':
      return 'bar';
    default:
      return 'bar';
  }
}

function resolveSeriesGeometry(
  fieldId: FieldId,
  config: CartesianChartConfigBody,
  chartKind: CartesianChartKind,
): ResolvedSeriesGeometry {
  const override = config.series?.find((entry) => entry.fieldId === fieldId)?.type;
  return override ?? defaultSeriesGeometry(chartKind);
}

function toEChartsSeriesType(
  geometry: ResolvedSeriesGeometry,
): 'bar' | 'line' | 'scatter' {
  return geometry === 'scatter' ? 'scatter' : geometry === 'area' ? 'line' : geometry;
}

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

function seriesColorAt(
  index: number,
  primary: string,
  palette: string[],
): string {
  if (index === 0) {
    return primary;
  }

  const others = palette.filter((color) => color !== primary);
  const pool = others.length > 0 ? others : palette;
  return pool[(index - 1) % pool.length];
}

function legendAwareMargins(
  margins: CartesianChartConfigBody['margins'],
  showLegend: boolean,
  placement: ChartLegendPlacement,
): CartesianChartConfigBody['margins'] {
  if (!showLegend) {
    return { ...margins };
  }

  if (placement === 'outside-left') {
    return { ...margins, left: Math.max(margins.left, 96) };
  }

  if (placement === 'outside-right') {
    return { ...margins, right: Math.max(margins.right, 96) };
  }

  return { ...margins, top: Math.max(margins.top, 40) };
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

  if (
    !results.fields[xField] ||
    yFields.some((fieldId) => !results.fields[fieldId])
  ) {
    return null;
  }

  const horizontal = config.layout.flipAxes || chartKind === 'horizontal_bar';
  const stacked =
    config.layout.stackMode === 'stack' ||
    config.layout.stackMode === 'percent';
  const labels = results.rows.map((row) => row[xField]?.value.formatted ?? '');
  const primaryColor = config.seriesColor ?? DEFAULT_COLOR_BY_KIND[chartKind];

  const series: SeriesOption[] = yFields.map((fieldId, index) => {
    const geometry = resolveSeriesGeometry(fieldId, config, chartKind);
    const seriesType = toEChartsSeriesType(geometry);
    const color = seriesColorAt(index, primaryColor, SERIES_COLORS);
    const base = {
      name: fieldLabel(results, fieldId),
      type: seriesType,
      data: results.rows.map((row) => toNumber(row[fieldId]?.value.raw)),
      stack: stacked ? 'stack' : undefined,
      label: { show: config.showValueLabels ?? false },
      itemStyle: { color },
    } as const;

    if (geometry === 'area') {
      return {
        ...base,
        lineStyle: { color, width: 2 },
        symbolSize: 8,
        areaStyle: {},
      };
    }

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
  const dimensionTitle = config.layout.xAxisLabel || dimensionLabel;
  const metricTitle = config.layout.yAxisLabel || metricLabel;
  const categoryAxisName = dashboardMode ? undefined : dimensionTitle;
  const valueAxisName = dashboardMode ? undefined : metricTitle;
  const valueAxisMax = config.layout.stackMode === 'percent' ? 100 : undefined;
  const gridMargins = legendAwareMargins(
    config.margins,
    config.showLegend,
    config.legendPlacement,
  );

  return {
    color: SERIES_COLORS,
    grid: {
      ...gridMargins,
      containLabel: true,
    },
    legend: buildLegend(config.showLegend, config.legendPlacement),
    tooltip: { trigger: 'axis' },
    xAxis: horizontal
      ? {
          type: 'value',
          name: valueAxisName,
          show: config.layout.showXAxis,
          max: valueAxisMax,
          splitLine: { show: config.layout.showGridX },
        }
      : {
          type: 'category',
          name: categoryAxisName,
          show: config.layout.showXAxis,
          data: labels,
          splitLine: { show: config.layout.showGridX },
          axisLabel: { rotate: dashboardMode ? 45 : 0 },
        },
    yAxis: horizontal
      ? {
          type: 'category',
          name: categoryAxisName,
          show: config.layout.showYAxis,
          data: labels,
          splitLine: { show: config.layout.showGridY },
        }
      : {
          type: 'value',
          name: valueAxisName,
          show: config.layout.showYAxis,
          max: valueAxisMax,
          splitLine: { show: config.layout.showGridY },
        },
    series,
  };
}
