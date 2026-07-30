import { LineageEdge } from '../../core/models/lineage.model';
import {
  getDirectDownstreamIds,
  getDirectUpstreamIds,
} from './lineage-focus-utils';

export type NeighborhoodSide = 'upstream' | 'downstream';

export interface ManualNeighborhoodExpansion {
  fromNodeId: string;
  side: NeighborhoodSide;
  neighborIds: readonly string[];
}

export interface ManualNeighborhoodState {
  expansions: readonly ManualNeighborhoodExpansion[];
}

export function emptyManualNeighborhood(): ManualNeighborhoodState {
  return { expansions: [] };
}

export function hasDirectNeighbors(
  nodeId: string,
  side: NeighborhoodSide,
  edges: LineageEdge[],
): boolean {
  const ids =
    side === 'upstream'
      ? getDirectUpstreamIds(nodeId, edges)
      : getDirectDownstreamIds(nodeId, edges);
  return ids.length > 0;
}

export function isNeighborhoodSideExpanded(
  state: ManualNeighborhoodState,
  nodeId: string,
  side: NeighborhoodSide,
): boolean {
  return state.expansions.some(
    (expansion) => expansion.fromNodeId === nodeId && expansion.side === side,
  );
}

export function toggleNeighborhoodSide(
  state: ManualNeighborhoodState,
  nodeId: string,
  side: NeighborhoodSide,
  edges: LineageEdge[],
): ManualNeighborhoodState {
  if (isNeighborhoodSideExpanded(state, nodeId, side)) {
    return {
      expansions: state.expansions.filter(
        (expansion) =>
          !(expansion.fromNodeId === nodeId && expansion.side === side),
      ),
    };
  }

  const neighborIds =
    side === 'upstream'
      ? getDirectUpstreamIds(nodeId, edges)
      : getDirectDownstreamIds(nodeId, edges);

  if (neighborIds.length === 0) {
    return state;
  }

  return {
    expansions: [
      ...state.expansions,
      { fromNodeId: nodeId, side, neighborIds: [...neighborIds] },
    ],
  };
}

export function collectManualNeighborIds(
  state: ManualNeighborhoodState,
): Set<string> {
  const ids = new Set<string>();
  for (const expansion of state.expansions) {
    for (const neighborId of expansion.neighborIds) {
      ids.add(neighborId);
    }
  }
  return ids;
}

export function unionHopAndManualIds(
  hopWindow: ReadonlySet<string> | null,
  state: ManualNeighborhoodState,
): Set<string> | null {
  if (hopWindow === null) {
    return null;
  }
  const manual = collectManualNeighborIds(state);
  if (manual.size === 0) {
    return new Set(hopWindow);
  }
  const next = new Set(hopWindow);
  for (const id of manual) {
    next.add(id);
  }
  return next;
}
