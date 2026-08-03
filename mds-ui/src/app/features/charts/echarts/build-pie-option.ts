import { EChartsOption } from 'echarts';
import {
  ChartLegendPlacement,
  PieChartConfigBody,
} from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';

const PIE_COLORS = [
  '#7262ff',
  '#5c7cfa',
  '#22b8cf',
  '#fab005',
  '#fd7e14',
  '#e64980',
];

export type BuildPieArgs = {
  results: QueryResults;
  config: PieChartConfigBody;
  dashboardMode?: boolean;
};

function toNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }

  return Number(raw) || 0;
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

export function buildPieOption({
  results,
  config,
}: BuildPieArgs): EChartsOption | null {
  const { xField, yField } = config;
  if (!xField || !yField || results.rows.length === 0) {
    return null;
  }

  return {
    color: PIE_COLORS,
    grid: {
      ...config.margins,
      containLabel: true,
    },
    legend: buildLegend(config.showLegend, config.legendPlacement),
    tooltip: { trigger: 'item' },
    series: [
      {
        name: results.fields[yField]?.label ?? yField,
        type: 'pie',
        radius: ['0%', '70%'],
        data: results.rows.map((row) => ({
          name: row[xField]?.value.formatted ?? '',
          value: toNumber(row[yField]?.value.raw),
        })),
      },
    ],
  };
}
