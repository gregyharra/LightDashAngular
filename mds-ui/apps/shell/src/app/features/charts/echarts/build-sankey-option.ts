import { EChartsOption } from 'echarts';
import { SankeyChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';

export type BuildSankeyArgs = {
  results: QueryResults;
  config: SankeyChartConfigBody;
  dashboardMode?: boolean;
};

function toNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }
  return Number(raw) || 0;
}

function cellLabel(
  results: QueryResults,
  row: QueryResults['rows'][number],
  fieldId: string,
): string {
  return row[fieldId]?.value.formatted ?? String(row[fieldId]?.value.raw ?? '');
}

export function buildSankeyOption({
  results,
  config,
}: BuildSankeyArgs): EChartsOption | null {
  const { sourceFieldId, targetFieldId, weightFieldId, showNodeLabels, margins } =
    config;

  if (
    !sourceFieldId ||
    !targetFieldId ||
    !weightFieldId ||
    results.rows.length === 0 ||
    !results.fields[sourceFieldId] ||
    !results.fields[targetFieldId] ||
    !results.fields[weightFieldId]
  ) {
    return null;
  }

  const linkMap = new Map<string, { source: string; target: string; value: number }>();

  for (const row of results.rows) {
    const source = cellLabel(results, row, sourceFieldId);
    const target = cellLabel(results, row, targetFieldId);
    const value = toNumber(row[weightFieldId]?.value.raw);
    if (!source || !target || source === target || value <= 0) {
      continue;
    }
    const key = `${source}\0${target}`;
    const existing = linkMap.get(key);
    if (existing) {
      existing.value += value;
    } else {
      linkMap.set(key, { source, target, value });
    }
  }

  const links = [...linkMap.values()];
  if (links.length === 0) {
    return null;
  }

  const nodeNames = new Set<string>();
  for (const link of links) {
    nodeNames.add(link.source);
    nodeNames.add(link.target);
  }

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
        type: 'sankey',
        emphasis: { focus: 'adjacency' },
        label: { show: showNodeLabels },
        data: [...nodeNames].map((name) => ({ name })),
        links,
      },
    ],
  };
}
