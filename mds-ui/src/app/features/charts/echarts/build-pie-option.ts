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

function pieLayout(
  margins: PieChartConfigBody['margins'],
  showLegend: boolean,
  placement: ChartLegendPlacement,
): { center: [string, string]; radius: [string, string] } {
  const left = Math.max(margins.left, showLegend && placement === 'outside-left' ? 96 : margins.left);
  const right = Math.max(
    margins.right,
    showLegend && placement === 'outside-right' ? 96 : margins.right,
  );
  const top = Math.max(margins.top, showLegend && placement === 'chart' ? 40 : margins.top);
  const bottom = margins.bottom;

  const centerX = `${50 + (left - right) / 4}%`;
  const centerY = `${50 + (top - bottom) / 4}%`;
  const radiusOuter = showLegend ? '58%' : '70%';

  return {
    center: [centerX, centerY],
    radius: ['0%', radiusOuter],
  };
}

export function buildPieOption({
  results,
  config,
}: BuildPieArgs): EChartsOption | null {
  const { xField, yField } = config;
  if (!xField || !yField || results.rows.length === 0) {
    return null;
  }

  if (!results.fields[xField] || !results.fields[yField]) {
    return null;
  }

  const layout = pieLayout(
    config.margins,
    config.showLegend,
    config.legendPlacement,
  );

  return {
    color: PIE_COLORS,
    legend: buildLegend(config.showLegend, config.legendPlacement),
    tooltip: { trigger: 'item' },
    series: [
      {
        name: results.fields[yField]?.label ?? yField,
        type: 'pie',
        center: layout.center,
        radius: layout.radius,
        data: results.rows.map((row) => ({
          name: row[xField]?.value.formatted ?? '',
          value: toNumber(row[yField]?.value.raw),
        })),
      },
    ],
  };
}
