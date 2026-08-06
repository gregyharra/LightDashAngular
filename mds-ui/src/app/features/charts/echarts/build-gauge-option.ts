import { EChartsOption } from 'echarts';
import { GaugeChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';

export type BuildGaugeArgs = {
  results: QueryResults;
  config: GaugeChartConfigBody;
  dashboardMode?: boolean;
};

function toNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }

  return Number(raw) || 0;
}

function defaultMax(value: number): number {
  return Math.max(value * 1.25, value, 1);
}

export function buildGaugeOption({
  results,
  config,
}: BuildGaugeArgs): EChartsOption | null {
  const { selectedField, min, max, showLabel, margins } = config;

  if (
    !selectedField ||
    results.rows.length === 0 ||
    !results.fields[selectedField]
  ) {
    return null;
  }

  const firstRow = results.rows[0];
  const value = toNumber(firstRow[selectedField]?.value.raw);
  const fieldLabel = results.fields[selectedField]?.label ?? selectedField;
  const gaugeMin = min ?? 0;
  const gaugeMax = max ?? defaultMax(value);

  return {
    tooltip: { trigger: 'item' },
    grid: {
      left: margins.left,
      right: margins.right,
      top: margins.top,
      bottom: margins.bottom,
    },
    series: [
      {
        type: 'gauge',
        min: gaugeMin,
        max: gaugeMax,
        startAngle: 200,
        endAngle: -20,
        center: ['50%', '60%'],
        radius: '80%',
        progress: { show: true, width: 12 },
        axisLine: { lineStyle: { width: 12 } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: {
          show: showLabel,
          offsetCenter: [0, '70%'],
          fontSize: 14,
        },
        detail: {
          show: showLabel,
          valueAnimation: true,
          offsetCenter: [0, '0%'],
          fontSize: 28,
          fontWeight: 600,
          formatter: '{value}',
        },
        data: [{ value, name: fieldLabel }],
      },
    ],
  };
}
