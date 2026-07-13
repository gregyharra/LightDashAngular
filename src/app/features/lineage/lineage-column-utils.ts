import {
  ColumnLineageEdge,
  LineageColumn,
  LineageNode,
} from '../../core/models/lineage.model';

/** Compact node header + one row per column when expanded in column view. */
export const LINEAGE_NODE_HEADER_HEIGHT = 72;
export const LINEAGE_COLUMN_ROW_HEIGHT = 22;
export const LINEAGE_NODE_WIDTH = 220;

export function getExpandedNodeHeight(node: LineageNode): number {
  const columnCount = node.columns?.length ?? 0;
  if (columnCount === 0) {
    return LINEAGE_NODE_HEADER_HEIGHT;
  }
  return LINEAGE_NODE_HEADER_HEIGHT + columnCount * LINEAGE_COLUMN_ROW_HEIGHT + 8;
}

export function getColumnY(nodePos: { y: number }, columnIndex: number): number {
  return nodePos.y + LINEAGE_NODE_HEADER_HEIGHT + columnIndex * LINEAGE_COLUMN_ROW_HEIGHT + 11;
}

export function columnRefKey(nodeId: string, columnName: string): string {
  return `${nodeId}::${columnName}`;
}

export function columnEdgeKey(edge: ColumnLineageEdge): string {
  return `${edge.sourceNodeId}::${edge.sourceColumn}->${edge.targetNodeId}::${edge.targetColumn}`;
}

export interface ColumnLineageHighlight {
  edgeKeys: Set<string>;
  columnKeys: Set<string>;
  upstreamColumnKeys: Set<string>;
  downstreamColumnKeys: Set<string>;
}

const EMPTY_COLUMN_HIGHLIGHT: ColumnLineageHighlight = {
  edgeKeys: new Set(),
  columnKeys: new Set(),
  upstreamColumnKeys: new Set(),
  downstreamColumnKeys: new Set(),
};

import { UNLIMITED_HOP_DEPTH } from './lineage-focus-utils';

/** Upstream + downstream column lineage from a selected column. */
export function computeColumnLineageHighlight(
  columnEdges: ColumnLineageEdge[],
  selected: { nodeId: string; columnName: string } | null,
  hopDepth: number = UNLIMITED_HOP_DEPTH,
): ColumnLineageHighlight {
  if (!selected) {
    return EMPTY_COLUMN_HIGHLIGHT;
  }

  const edgeKeys = new Set<string>();
  const columnKeys = new Set<string>();
  const upstreamColumnKeys = new Set<string>();
  const downstreamColumnKeys = new Set<string>();

  const selectedKey = columnRefKey(selected.nodeId, selected.columnName);
  columnKeys.add(selectedKey);

  const upstream = new Map<string, Set<string>>();
  const downstream = new Map<string, Set<string>>();

  for (const edge of columnEdges) {
    const sourceKey = columnRefKey(edge.sourceNodeId, edge.sourceColumn);
    const targetKey = columnRefKey(edge.targetNodeId, edge.targetColumn);
    const key = columnEdgeKey(edge);

    (downstream.get(sourceKey) ?? downstream.set(sourceKey, new Set()).get(sourceKey))!.add(key);
    (upstream.get(targetKey) ?? upstream.set(targetKey, new Set()).get(targetKey))!.add(key);
  }

  if (hopDepth === UNLIMITED_HOP_DEPTH) {
    const visitUpstream = (key: string): void => {
      for (const edgeKey of upstream.get(key) ?? []) {
        if (edgeKeys.has(edgeKey)) {
          continue;
        }
        edgeKeys.add(edgeKey);
        const edge = columnEdges.find((e) => columnEdgeKey(e) === edgeKey);
        if (edge) {
          const parentKey = columnRefKey(edge.sourceNodeId, edge.sourceColumn);
          columnKeys.add(parentKey);
          upstreamColumnKeys.add(parentKey);
          visitUpstream(parentKey);
        }
      }
    };

    const visitDownstream = (key: string): void => {
      for (const edgeKey of downstream.get(key) ?? []) {
        if (edgeKeys.has(edgeKey)) {
          continue;
        }
        edgeKeys.add(edgeKey);
        const edge = columnEdges.find((e) => columnEdgeKey(e) === edgeKey);
        if (edge) {
          const childKey = columnRefKey(edge.targetNodeId, edge.targetColumn);
          columnKeys.add(childKey);
          downstreamColumnKeys.add(childKey);
          visitDownstream(childKey);
        }
      }
    };

    visitUpstream(selectedKey);
    visitDownstream(selectedKey);
  } else {
    let upstreamLayer = new Set([selectedKey]);
    let downstreamLayer = new Set([selectedKey]);

    for (let hop = 0; hop < hopDepth; hop++) {
      const nextUpstream = new Set<string>();
      for (const key of upstreamLayer) {
        for (const edgeKey of upstream.get(key) ?? []) {
          if (edgeKeys.has(edgeKey)) {
            continue;
          }
          edgeKeys.add(edgeKey);
          const edge = columnEdges.find((e) => columnEdgeKey(e) === edgeKey);
          if (edge) {
            const parentKey = columnRefKey(edge.sourceNodeId, edge.sourceColumn);
            columnKeys.add(parentKey);
            upstreamColumnKeys.add(parentKey);
            nextUpstream.add(parentKey);
          }
        }
      }
      upstreamLayer = nextUpstream;

      const nextDownstream = new Set<string>();
      for (const key of downstreamLayer) {
        for (const edgeKey of downstream.get(key) ?? []) {
          if (edgeKeys.has(edgeKey)) {
            continue;
          }
          edgeKeys.add(edgeKey);
          const edge = columnEdges.find((e) => columnEdgeKey(e) === edgeKey);
          if (edge) {
            const childKey = columnRefKey(edge.targetNodeId, edge.targetColumn);
            columnKeys.add(childKey);
            downstreamColumnKeys.add(childKey);
            nextDownstream.add(childKey);
          }
        }
      }
      downstreamLayer = nextDownstream;
    }
  }

  return { edgeKeys, columnKeys, upstreamColumnKeys, downstreamColumnKeys };
}

export function parseColumnRefKey(key: string): { nodeId: string; columnName: string } {
  const separator = key.indexOf('::');
  return {
    nodeId: key.slice(0, separator),
    columnName: key.slice(separator + 2),
  };
}

export function getNodeIdsFromColumnKeys(columnKeys: Set<string>): Set<string> {
  const nodeIds = new Set<string>();
  for (const key of columnKeys) {
    nodeIds.add(parseColumnRefKey(key).nodeId);
  }
  return nodeIds;
}

export function resolveColumnRefs(
  columnKeys: Set<string>,
  nodes: LineageNode[],
): { node: LineageNode; column: LineageColumn }[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const results: { node: LineageNode; column: LineageColumn }[] = [];

  for (const key of columnKeys) {
    const { nodeId, columnName } = parseColumnRefKey(key);
    const node = nodeById.get(nodeId);
    const column = node?.columns?.find((c) => c.name === columnName);
    if (node && column) {
      results.push({ node, column });
    }
  }

  return results.sort((a, b) => {
    const nameCmp = a.node.name.localeCompare(b.node.name);
    return nameCmp !== 0 ? nameCmp : a.column.name.localeCompare(b.column.name);
  });
}

export function getColumnIndex(node: LineageNode, columnName: string): number {
  return (node.columns ?? []).findIndex((col) => col.name === columnName);
}

export interface ColumnEdgePath {
  edge: ColumnLineageEdge;
  path: string;
  key: string;
}

export function buildColumnEdgePaths(
  columnEdges: ColumnLineageEdge[],
  positions: Map<string, { x: number; y: number; width: number; height: number }>,
  nodes: LineageNode[],
): ColumnEdgePath[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  return columnEdges
    .map((edge) => {
      const sourcePos = positions.get(edge.sourceNodeId);
      const targetPos = positions.get(edge.targetNodeId);
      const sourceNode = nodeById.get(edge.sourceNodeId);
      const targetNode = nodeById.get(edge.targetNodeId);

      if (!sourcePos || !targetPos || !sourceNode || !targetNode) {
        return null;
      }

      const sourceIdx = getColumnIndex(sourceNode, edge.sourceColumn);
      const targetIdx = getColumnIndex(targetNode, edge.targetColumn);

      if (sourceIdx < 0 || targetIdx < 0) {
        return null;
      }

      const startX = sourcePos.x + sourcePos.width;
      const startY = getColumnY(sourcePos, sourceIdx);
      const endX = targetPos.x;
      const endY = getColumnY(targetPos, targetIdx);
      const controlOffset = Math.max(40, (endX - startX) * 0.45);

      const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

      return { edge, path, key: columnEdgeKey(edge) };
    })
    .filter((item): item is ColumnEdgePath => item !== null);
}

export function sortColumns(columns: LineageColumn[], sortKey: 'name' | 'type'): LineageColumn[] {
  return [...columns].sort((a, b) => a[sortKey].localeCompare(b[sortKey]));
}

export function getColumnUpstream(
  columnEdges: ColumnLineageEdge[],
  nodes: LineageNode[],
  nodeId: string,
  columnName: string,
): { node: LineageNode; column: LineageColumn }[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const results: { node: LineageNode; column: LineageColumn }[] = [];

  for (const edge of columnEdges) {
    if (edge.targetNodeId === nodeId && edge.targetColumn === columnName) {
      const node = nodeById.get(edge.sourceNodeId);
      const column = node?.columns?.find((c) => c.name === edge.sourceColumn);
      if (node && column) {
        results.push({ node, column });
      }
    }
  }

  return results;
}

export function getColumnDownstream(
  columnEdges: ColumnLineageEdge[],
  nodes: LineageNode[],
  nodeId: string,
  columnName: string,
): { node: LineageNode; column: LineageColumn }[] {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const results: { node: LineageNode; column: LineageColumn }[] = [];

  for (const edge of columnEdges) {
    if (edge.sourceNodeId === nodeId && edge.sourceColumn === columnName) {
      const node = nodeById.get(edge.targetNodeId);
      const column = node?.columns?.find((c) => c.name === edge.targetColumn);
      if (node && column) {
        results.push({ node, column });
      }
    }
  }

  return results;
}
