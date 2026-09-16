import { LineageEdge, LineageNode } from '../../core/models/lineage.model';
import { getCollapsedNodeHeight, LINEAGE_NODE_WIDTH } from './lineage-column-utils';
import {
  layoutLineageNodes,
  NEIGHBOR_PLACE_GAP_X,
  placeNeighborsAroundAnchor,
} from './lineage-layout';

function node(id: string, name: string, type: LineageNode['type']): LineageNode {
  return {
    id,
    name,
    type,
    schema: 's',
    database: 'd',
    catalog: 'c',
    columnCount: 0,
  };
}

describe('layoutLineageNodes', () => {
  it('places upstream left of downstream (staging → mart)', () => {
    const nodes = [
      node('fct', 'fct_orders', 'mart'),
      node('stg', 'stg_orders', 'staging'),
      node('dim', 'dim_customers', 'mart'),
    ];
    const edges: LineageEdge[] = [
      { source: 'stg', target: 'fct' },
      { source: 'dim', target: 'fct' },
    ];

    const positions = layoutLineageNodes(nodes, edges, 'models', new Set());
    const stg = positions.get('stg')!;
    const dim = positions.get('dim')!;
    const fct = positions.get('fct')!;

    expect(stg.x).toBeLessThan(fct.x);
    expect(dim.x).toBeLessThan(fct.x);
    expect(fct.x - stg.x).toBeGreaterThanOrEqual(LINEAGE_NODE_WIDTH);
  });

  it('keeps source → staging → mart left-to-right by layer', () => {
    const nodes = [
      node('raw', 'raw_orders', 'source'),
      node('stg', 'stg_orders', 'staging'),
      node('fct', 'fct_orders', 'mart'),
    ];
    const edges: LineageEdge[] = [
      { source: 'raw', target: 'stg' },
      { source: 'stg', target: 'fct' },
    ];

    const positions = layoutLineageNodes(nodes, edges, 'models', new Set());
    expect(positions.get('raw')!.x).toBeLessThan(positions.get('stg')!.x);
    expect(positions.get('stg')!.x).toBeLessThan(positions.get('fct')!.x);
  });
});

describe('placeNeighborsAroundAnchor', () => {
  const anchor = {
    x: 400,
    y: 100,
    width: LINEAGE_NODE_WIDTH,
    height: getCollapsedNodeHeight(),
  };

  it('places upstream neighbors to the left of the anchor', () => {
    const placed = placeNeighborsAroundAnchor(anchor, ['stg', 'dim'], 'upstream');
    expect(placed.get('dim')!.x).toBe(anchor.x - NEIGHBOR_PLACE_GAP_X);
    expect(placed.get('stg')!.x).toBe(anchor.x - NEIGHBOR_PLACE_GAP_X);
    expect(placed.get('dim')!.y).toBeLessThan(placed.get('stg')!.y);
  });

  it('places downstream neighbors to the right of the anchor', () => {
    const placed = placeNeighborsAroundAnchor(anchor, ['rev'], 'downstream');
    expect(placed.get('rev')!.x).toBe(anchor.x + NEIGHBOR_PLACE_GAP_X);
  });

  it('skips ids that are already placed / visible', () => {
    const placed = placeNeighborsAroundAnchor(anchor, ['stg', 'dim'], 'upstream', {
      alreadyPlacedIds: new Set(['stg']),
    });
    expect(placed.has('stg')).toBeFalse();
    expect(placed.has('dim')).toBeTrue();
  });
});
