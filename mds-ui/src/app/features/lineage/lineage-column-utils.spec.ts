import {
  LINEAGE_MAX_VISIBLE_COLUMNS,
  LINEAGE_NODE_FOOTER_HEIGHT,
  LINEAGE_NODE_HEADER_HEIGHT,
  columnRefKey,
  getCollapsedNodeHeight,
  getColumnAnchorY,
  getExpandedNodeHeight,
  getMaxColumnScrollTop,
  orderColumnsForDisplay,
} from './lineage-column-utils';
import { LineageColumn, LineageNode } from '../../core/models/lineage.model';

function makeNode(columns: LineageColumn[]): LineageNode {
  return {
    id: 'model.x',
    name: 'x',
    type: 'mart',
    schema: 'marts',
    columnCount: columns.length,
    columns,
  } as LineageNode;
}

function cols(names: string[]): LineageColumn[] {
  return names.map((name) => ({ name, type: 'varchar' }));
}

describe('lineage-column-utils density helpers', () => {
  it('caps expanded node height at max visible columns', () => {
    const short = makeNode(cols(['a', 'b', 'c']));
    const tall = makeNode(cols(Array.from({ length: 20 }, (_, i) => `c${i}`)));

    const shortHeight = getExpandedNodeHeight(short);
    const tallHeight = getExpandedNodeHeight(tall);

    expect(tallHeight).toBe(
      getExpandedNodeHeight(
        makeNode(cols(Array.from({ length: LINEAGE_MAX_VISIBLE_COLUMNS }, (_, i) => `c${i}`))),
      ),
    );
    expect(shortHeight).toBeLessThan(tallHeight);
  });

  it('collapsed card height is header + footer', () => {
    expect(getCollapsedNodeHeight()).toBe(
      LINEAGE_NODE_HEADER_HEIGHT + LINEAGE_NODE_FOOTER_HEIGHT,
    );
  });

  it('falls back to the collapsed height when a node has no columns', () => {
    const empty = makeNode([]);
    expect(getExpandedNodeHeight(empty)).toBe(getCollapsedNodeHeight());
  });

  it('expanded height always includes header and footer around the column body', () => {
    const node = makeNode(cols(['a', 'b', 'c']));
    const expanded = getExpandedNodeHeight(node);
    expect(expanded).toBeGreaterThan(LINEAGE_NODE_HEADER_HEIGHT + LINEAGE_NODE_FOOTER_HEIGHT);
  });

  it('orders selected and highlighted columns first', () => {
    const columns = cols(['a', 'b', 'c', 'd']);
    const ordered = orderColumnsForDisplay(columns, 'model.x', {
      selectedColumnName: 'c',
      highlightedKeys: new Set([columnRefKey('model.x', 'a')]),
    });

    expect(ordered.map((c) => c.name)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('anchors scrolled-out columns to the header center', () => {
    const pos = { y: 100 };
    const columnCount = 20;
    const scrollTop = getMaxColumnScrollTop(columnCount);

    const visibleY = getColumnAnchorY(pos, 0, 0, columnCount);
    expect(visibleY).toBeGreaterThan(pos.y + LINEAGE_NODE_HEADER_HEIGHT);

    const hiddenY = getColumnAnchorY(pos, 0, scrollTop, columnCount);
    expect(hiddenY).toBe(pos.y + LINEAGE_NODE_HEADER_HEIGHT / 2);
  });
});
