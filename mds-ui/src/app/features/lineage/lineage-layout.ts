import {
  LineageEdge,
  LineageNode,
  LineageNodePosition,
  LineageNodeType,
  LineageViewMode,
} from '../../core/models/lineage.model';
import {
  getExpandedNodeHeight,
  LINEAGE_NODE_WIDTH,
} from './lineage-column-utils';

/** Minimum layer index by node type (sources/seeds left, marts right). */
const TYPE_MIN_LAYER: Record<LineageNodeType, number> = {
  source: 0,
  seed: 0,
  staging: 1,
  mart: 2,
};

const NODE_GAP_Y = 28;
const LAYER_GAP_X = 120;
const PADDING_X = 64;
const PADDING_Y = 48;
const BARYCENTER_ITERATIONS = 4;

export function layoutLineageNodes(
  nodes: LineageNode[],
  edges: LineageEdge[],
  viewMode: LineageViewMode = 'models',
  expandedNodeIds: ReadonlySet<string> = new Set(),
): Map<string, LineageNodePosition> {
  if (nodes.length === 0) {
    return new Map();
  }

  const nodeLayers = computeNodeLayers(nodes, edges);
  const layerGroups = groupNodesByLayer(nodes, nodeLayers);
  orderLayersByBarycenter(layerGroups, edges);
  return assignPositions(layerGroups, viewMode, expandedNodeIds);
}

/** Longest-path layering with type hints for disconnected nodes. */
function computeNodeLayers(nodes: LineageNode[], edges: LineageEdge[]): Map<string, number> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const layers = new Map<string, number>();

  for (const node of nodes) {
    layers.set(node.id, TYPE_MIN_LAYER[node.type] ?? 1);
  }

  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        continue;
      }
      const nextLayer = layers.get(edge.source)! + 1;
      if (nextLayer > layers.get(edge.target)!) {
        layers.set(edge.target, nextLayer);
        changed = true;
      }
    }
    if (!changed) {
      break;
    }
  }

  return normalizeLayers(layers);
}

function normalizeLayers(layers: Map<string, number>): Map<string, number> {
  const sorted = [...new Set(layers.values())].sort((a, b) => a - b);
  const remap = new Map(sorted.map((layer, index) => [layer, index]));
  const normalized = new Map<string, number>();
  for (const [nodeId, layer] of layers) {
    normalized.set(nodeId, remap.get(layer) ?? 0);
  }
  return normalized;
}

function groupNodesByLayer(
  nodes: LineageNode[],
  nodeLayers: Map<string, number>,
): Map<number, LineageNode[]> {
  const layerGroups = new Map<number, LineageNode[]>();

  for (const node of nodes) {
    const layer = nodeLayers.get(node.id) ?? 0;
    const bucket = layerGroups.get(layer) ?? [];
    bucket.push(node);
    layerGroups.set(layer, bucket);
  }

  for (const [, layerNodes] of layerGroups) {
    layerNodes.sort((a, b) => a.name.localeCompare(b.name));
  }

  return layerGroups;
}

/** Sugiyama-style barycenter passes to reduce edge crossings within layers. */
function orderLayersByBarycenter(
  layerGroups: Map<number, LineageNode[]>,
  edges: LineageEdge[],
): void {
  if (layerGroups.size <= 1) {
    return;
  }

  const inNeighbors = new Map<string, string[]>();
  const outNeighbors = new Map<string, string[]>();

  for (const edge of edges) {
    (inNeighbors.get(edge.target) ?? inNeighbors.set(edge.target, []).get(edge.target)!).push(
      edge.source,
    );
    (outNeighbors.get(edge.source) ?? outNeighbors.set(edge.source, []).get(edge.source)!).push(
      edge.target,
    );
  }

  const layerIndices = [...layerGroups.keys()].sort((a, b) => a - b);
  const maxLayer = layerIndices[layerIndices.length - 1] ?? 0;

  for (let iteration = 0; iteration < BARYCENTER_ITERATIONS; iteration++) {
    const downward = iteration % 2 === 0;
    const visitOrder = downward
      ? layerIndices.filter((layer) => layer > 0)
      : [...layerIndices].reverse().filter((layer) => layer < maxLayer);

    for (const layer of visitOrder) {
      const layerNodes = layerGroups.get(layer);
      if (!layerNodes || layerNodes.length <= 1) {
        continue;
      }

      const neighborLayer = downward ? layer - 1 : layer + 1;
      const neighborNodes = layerGroups.get(neighborLayer);
      if (!neighborNodes?.length) {
        continue;
      }

      const neighborIndex = new Map(neighborNodes.map((node, index) => [node.id, index]));
      const barycenters = new Map<string, number>();

      for (const node of layerNodes) {
        const neighbors = (downward ? inNeighbors : outNeighbors).get(node.id) ?? [];
        const indices = neighbors
          .map((id) => neighborIndex.get(id))
          .filter((index): index is number => index !== undefined);

        if (indices.length === 0) {
          barycenters.set(node.id, layerNodes.indexOf(node));
        } else {
          barycenters.set(
            node.id,
            indices.reduce((sum, index) => sum + index, 0) / indices.length,
          );
        }
      }

      layerNodes.sort((a, b) => {
        const delta = (barycenters.get(a.id) ?? 0) - (barycenters.get(b.id) ?? 0);
        return delta !== 0 ? delta : a.name.localeCompare(b.name);
      });
    }
  }
}

function assignPositions(
  layerGroups: Map<number, LineageNode[]>,
  viewMode: LineageViewMode,
  expandedNodeIds: ReadonlySet<string>,
): Map<string, LineageNodePosition> {
  const positions = new Map<string, LineageNodePosition>();
  const sortedLayers = [...layerGroups.entries()].sort(([a], [b]) => a - b);
  const maxStack = getMaxStackHeight(layerGroups, viewMode, expandedNodeIds);

  for (const [layerIndex, layerNodes] of sortedLayers) {
    const x = PADDING_X + layerIndex * (LINEAGE_NODE_WIDTH + LAYER_GAP_X);
    const stackHeight = layerNodes.reduce((sum, node, index) => {
      const height = nodeHeight(node, viewMode, expandedNodeIds);
      const gap = index > 0 ? NODE_GAP_Y : 0;
      return sum + gap + height;
    }, 0);

    let y = PADDING_Y + Math.max(0, (maxStack - stackHeight) / 2);

    for (const node of layerNodes) {
      const height = nodeHeight(node, viewMode, expandedNodeIds);
      positions.set(node.id, {
        x,
        y,
        width: LINEAGE_NODE_WIDTH,
        height,
      });
      y += height + NODE_GAP_Y;
    }
  }

  return positions;
}

function nodeHeight(
  node: LineageNode,
  viewMode: LineageViewMode,
  expandedNodeIds: ReadonlySet<string>,
): number {
  const expanded =
    (viewMode === 'columns' || expandedNodeIds.has(node.id)) && !!node.columns?.length;
  if (expanded) {
    return getExpandedNodeHeight(node);
  }
  return 72;
}

function getMaxStackHeight(
  layers: Map<number, LineageNode[]>,
  viewMode: LineageViewMode,
  expandedNodeIds: ReadonlySet<string>,
): number {
  let max = 0;
  for (const layerNodes of layers.values()) {
    const height = layerNodes.reduce((sum, node, index) => {
      const h = nodeHeight(node, viewMode, expandedNodeIds);
      const gap = index > 0 ? NODE_GAP_Y : 0;
      return sum + gap + h;
    }, 0);
    max = Math.max(max, height);
  }
  return max;
}

export function getGraphBounds(positions: Map<string, LineageNodePosition>): {
  width: number;
  height: number;
} {
  let maxX = 0;
  let maxY = 0;

  for (const pos of positions.values()) {
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  }

  return {
    width: maxX + PADDING_X,
    height: maxY + PADDING_Y,
  };
}

export interface LineageEdgePath {
  edge: LineageEdge;
  path: string;
}

export function buildEdgePaths(
  edges: LineageEdge[],
  positions: Map<string, LineageNodePosition>,
): LineageEdgePath[] {
  return edges
    .map((edge) => {
      const source = positions.get(edge.source);
      const target = positions.get(edge.target);
      if (!source || !target) {
        return null;
      }

      const startX = source.x + source.width;
      const startY = source.y + Math.min(36, source.height / 2);
      const endX = target.x;
      const endY = target.y + Math.min(36, target.height / 2);
      const controlOffset = Math.max(40, (endX - startX) * 0.45);

      const path = `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;

      return { edge, path };
    })
    .filter((item): item is LineageEdgePath => item !== null);
}
