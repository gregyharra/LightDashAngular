import { EChartsOption } from 'echarts';
import {
  ChartLegendPlacement,
  FunnelChartConfigBody,
} from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';

const FUNNEL_COLORS = [
  '#7262ff',
  '#5c7cfa',
  '#22b8cf',
  '#fab005',
  '#fd7e14',
  '#e64980',
];

export type BuildFunnelArgs = {
  results: QueryResults;
  config: FunnelChartConfigBody;
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

function buildColumnData(
  results: QueryResults,
  fieldId: string,
  labelFieldId?: string,
): { name: string; value: number }[] {
  return results.rows.map((row, index) => {
    const labelCell = labelFieldId ? row[labelFieldId] : undefined;
    const name = labelCell?.value.formatted ?? `Step ${index + 1}`;
    return {
      name,
      value: toNumber(row[fieldId]?.value.raw),
    };
  });
}

function buildRowData(
  results: QueryResults,
  fieldId: string,
): { name: string; value: number }[] {
  const firstRow = results.rows[0];
  if (!firstRow) {
    return [];
  }

  const metricFieldIds = Object.keys(results.fields).filter(
    (id) => results.fields[id]?.fieldType === 'metric',
  );

  const fieldIds =
    metricFieldIds.length > 0
      ? metricFieldIds
      : fieldId in firstRow
        ? [fieldId]
        : [];

  return fieldIds.map((id) => ({
    name: results.fields[id]?.label ?? id,
    value: toNumber(firstRow[id]?.value.raw),
  }));
}

export function buildFunnelOption({
  results,
  config,
}: BuildFunnelArgs): EChartsOption | null {
  const { fieldId, labelFieldId, dataInput, showLegend, legendPlacement, margins } =
    config;

  if (!fieldId || results.rows.length === 0 || !results.fields[fieldId]) {
    return null;
  }

  const data =
    dataInput === 'row'
      ? buildRowData(results, fieldId)
      : buildColumnData(results, fieldId, labelFieldId);

  if (data.length === 0) {
    return null;
  }

  const legendTopOffset =
    showLegend && legendPlacement === 'chart' ? 40 : 0;

  return {
    color: FUNNEL_COLORS,
    legend: buildLegend(showLegend, legendPlacement),
    tooltip: { trigger: 'item' },
    series: [
      {
        name: results.fields[fieldId]?.label ?? fieldId,
        type: 'funnel',
        gap: 3,
        left: margins.left,
        right: margins.right,
        top: margins.top + legendTopOffset,
        bottom: margins.bottom,
        data,
      },
    ],
  };
}
