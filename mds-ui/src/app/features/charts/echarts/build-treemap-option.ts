import { EChartsOption } from 'echarts';
import { TreemapChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';

const TREEMAP_COLORS = [
  '#7262ff',
  '#5c7cfa',
  '#22b8cf',
  '#fab005',
  '#fd7e14',
  '#e64980',
];

export type BuildTreemapArgs = {
  results: QueryResults;
  config: TreemapChartConfigBody;
  dashboardMode?: boolean;
};

type TreemapNode = {
  name: string;
  value?: number;
  children?: TreemapNode[];
};

type MutableTreemapNode = {
  name: string;
  value?: number;
  children: Record<string, MutableTreemapNode>;
};

function toNumber(raw: unknown): number {
  if (typeof raw === 'number') {
    return raw;
  }

  return Number(raw) || 0;
}

function getCellLabel(
  row: QueryResults['rows'][number],
  fieldId: string,
): string {
  const cell = row[fieldId];
  return cell?.value.formatted ?? String(cell?.value.raw ?? '');
}

function getCellRawKey(
  row: QueryResults['rows'][number],
  fieldId: string,
): string {
  const cell = row[fieldId];
  return String(cell?.value.raw ?? '');
}

function buildFlatLeaves(
  results: QueryResults,
  dimensionFieldId: string,
  metricFieldId: string,
): TreemapNode[] {
  return results.rows.map((row) => ({
    name: getCellLabel(row, dimensionFieldId),
    value: toNumber(row[metricFieldId]?.value.raw),
  }));
}

function buildNestedTree(
  results: QueryResults,
  dimensionFieldIds: string[],
  metricFieldId: string,
): TreemapNode[] {
  const root: MutableTreemapNode = { name: 'root', children: {} };

  for (const row of results.rows) {
    let parent = root;

    for (let index = 0; index < dimensionFieldIds.length; index++) {
      const dimensionFieldId = dimensionFieldIds[index];
      const rawKey = getCellRawKey(row, dimensionFieldId);

      if (!parent.children[rawKey]) {
        parent.children[rawKey] = {
          name: getCellLabel(row, dimensionFieldId),
          children: {},
        };
      }

      if (index === dimensionFieldIds.length - 1) {
        parent.children[rawKey].value = toNumber(row[metricFieldId]?.value.raw);
      }

      parent = parent.children[rawKey];
    }
  }

  const convert = (node: MutableTreemapNode): TreemapNode => {
    const children = Object.values(node.children).map(convert);
    return {
      name: node.name,
      ...(node.value !== undefined ? { value: node.value } : {}),
      ...(children.length > 0 ? { children } : {}),
    };
  };

  return Object.values(root.children).map(convert);
}

export function buildTreemapOption({
  results,
  config,
}: BuildTreemapArgs): EChartsOption | null {
  const { dimensionFieldIds, metricFieldId, showLegend, margins } = config;

  if (
    !metricFieldId ||
    dimensionFieldIds.length === 0 ||
    results.rows.length === 0 ||
    !results.fields[metricFieldId]
  ) {
    return null;
  }

  for (const dimensionFieldId of dimensionFieldIds) {
    if (!results.fields[dimensionFieldId]) {
      return null;
    }
  }

  const children =
    dimensionFieldIds.length === 1
      ? buildFlatLeaves(results, dimensionFieldIds[0], metricFieldId)
      : buildNestedTree(results, dimensionFieldIds, metricFieldId);

  if (children.length === 0) {
    return null;
  }

  return {
    color: TREEMAP_COLORS,
    legend: { show: showLegend },
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'treemap',
        left: margins.left,
        right: margins.right,
        top: margins.top,
        bottom: margins.bottom,
        data: [{ name: 'All', children }],
      },
    ],
  };
}
