import { LineageEdge, LineageNode } from '../../core/models/lineage.model';

export type LineageHopDepth = number;

export const UNLIMITED_HOP_DEPTH = Infinity;

function buildAdjacency(edges: LineageEdge[]): {
  upstream: Map<string, string[]>;
  downstream: Map<string, string[]>;
} {
  const upstream = new Map<string, string[]>();
  const downstream = new Map<string, string[]>();

  for (const edge of edges) {
    (upstream.get(edge.target) ?? upstream.set(edge.target, []).get(edge.target)!).push(edge.source);
    (downstream.get(edge.source) ?? downstream.set(edge.source, []).get(edge.source)!).push(edge.target);
  }

  return { upstream, downstream };
}

/** Nodes reachable within hopDepth hops upstream and downstream of the selection. */
export function computeRelatedNodeIds(
  nodeId: string,
  edges: LineageEdge[],
  hopDepth: LineageHopDepth = UNLIMITED_HOP_DEPTH,
): Set<string> {
  if (hopDepth === UNLIMITED_HOP_DEPTH) {
    return computeFullRelatedNodeIds(nodeId, edges);
  }

  const related = new Set<string>([nodeId]);
  const { upstream, downstream } = buildAdjacency(edges);

  let upstreamLayer = new Set([nodeId]);
  let downstreamLayer = new Set([nodeId]);

  for (let hop = 0; hop < hopDepth; hop++) {
    const nextUpstream = new Set<string>();
    for (const id of upstreamLayer) {
      for (const parentId of upstream.get(id) ?? []) {
        if (!related.has(parentId)) {
          related.add(parentId);
          nextUpstream.add(parentId);
        }
      }
    }
    upstreamLayer = nextUpstream;

    const nextDownstream = new Set<string>();
    for (const id of downstreamLayer) {
      for (const childId of downstream.get(id) ?? []) {
        if (!related.has(childId)) {
          related.add(childId);
          nextDownstream.add(childId);
        }
      }
    }
    downstreamLayer = nextDownstream;
  }

  return related;
}

function computeFullRelatedNodeIds(nodeId: string, edges: LineageEdge[]): Set<string> {
  const related = new Set<string>([nodeId]);

  const visitUpstream = (id: string): void => {
    for (const edge of edges) {
      if (edge.target === id && !related.has(edge.source)) {
        related.add(edge.source);
        visitUpstream(edge.source);
      }
    }
  };

  const visitDownstream = (id: string): void => {
    for (const edge of edges) {
      if (edge.source === id && !related.has(edge.target)) {
        related.add(edge.target);
        visitDownstream(edge.target);
      }
    }
  };

  visitUpstream(nodeId);
  visitDownstream(nodeId);

  return related;
}

/** Maximum hop distance from the selection to any upstream or downstream node. */
export function computeMaxHopDepth(nodeId: string, edges: LineageEdge[]): number {
  const { upstream, downstream } = buildAdjacency(edges);
  let maxDepth = 0;

  const walkUpstream = (id: string, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth);
    for (const parentId of upstream.get(id) ?? []) {
      walkUpstream(parentId, depth + 1);
    }
  };

  const walkDownstream = (id: string, depth: number): void => {
    maxDepth = Math.max(maxDepth, depth);
    for (const childId of downstream.get(id) ?? []) {
      walkDownstream(childId, depth + 1);
    }
  };

  walkUpstream(nodeId, 0);
  walkDownstream(nodeId, 0);

  return Math.max(maxDepth, 1);
}

export function getFocusSubgraph(
  nodes: LineageNode[],
  edges: LineageEdge[],
  selectedNodeId: string,
  hopDepth: LineageHopDepth,
): { nodes: LineageNode[]; edges: LineageEdge[] } {
  const relatedIds = computeRelatedNodeIds(selectedNodeId, edges, hopDepth);
  return {
    nodes: nodes.filter((node) => relatedIds.has(node.id)),
    edges: edges.filter((edge) => isEdgeInSubgraph(edge, relatedIds)),
  };
}

export function getDirectUpstreamIds(nodeId: string, edges: LineageEdge[]): string[] {
  return edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
}

export function getDirectDownstreamIds(nodeId: string, edges: LineageEdge[]): string[] {
  return edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
}

export function isEdgeInSubgraph(
  edge: LineageEdge,
  relatedIds: Set<string>,
): boolean {
  return relatedIds.has(edge.source) && relatedIds.has(edge.target);
}
