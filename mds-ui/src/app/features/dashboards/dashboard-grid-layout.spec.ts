import {
  applyTileLayoutChange,
  GridLayoutItem,
  layoutHasOverlaps,
} from './dashboard-grid-layout';

function item(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): GridLayoutItem {
  return { id, x, y, w, h };
}

describe('dashboard-grid-layout', () => {
  it('compacts a dragged tile upward when space is available above', () => {
    const layout = [
      item('a', 0, 0, 18, 9),
      item('b', 18, 0, 18, 9),
    ];

    const result = applyTileLayoutChange(layout, 'a', { x: 0, y: 10 });

    expect(layoutHasOverlaps(result)).toBeFalse();
    expect(result.find((tile) => tile.id === 'a')).toEqual(
      jasmine.objectContaining({ x: 0, y: 0 }),
    );
    expect(result.find((tile) => tile.id === 'b')).toEqual(
      jasmine.objectContaining({ x: 18, y: 0 }),
    );
  });

  it('leaves no overlaps after dragging below existing tiles', () => {
    const layout = [
      item('a', 0, 0, 18, 9),
      item('b', 0, 9, 18, 9),
    ];

    const result = applyTileLayoutChange(layout, 'a', { x: 0, y: 20 });

    expect(layoutHasOverlaps(result)).toBeFalse();
    expect(result.find((tile) => tile.id === 'a')!.y).toBeGreaterThanOrEqual(9);
    expect(result.find((tile) => tile.id === 'b')!.y).toBeLessThan(
      result.find((tile) => tile.id === 'a')!.y,
    );
  });

  it('pushes colliding tiles down when dragging over another tile', () => {
    const layout = [
      item('a', 0, 0, 18, 9),
      item('b', 18, 0, 18, 9),
    ];

    const result = applyTileLayoutChange(layout, 'a', { x: 9, y: 0 });

    expect(layoutHasOverlaps(result)).toBeFalse();
    expect(result.find((tile) => tile.id === 'a')).toEqual(
      jasmine.objectContaining({ x: 9, y: 0 }),
    );
    expect(result.find((tile) => tile.id === 'b')!.y).toBeGreaterThanOrEqual(9);
  });

  it('rearranges tiles when resizing into another tile', () => {
    const layout = [
      item('a', 0, 0, 18, 9),
      item('b', 18, 0, 18, 9),
    ];

    const result = applyTileLayoutChange(layout, 'a', { w: 24 });

    expect(layoutHasOverlaps(result)).toBeFalse();
    expect(result.find((tile) => tile.id === 'a')).toEqual(
      jasmine.objectContaining({ w: 24 }),
    );
    expect(result.find((tile) => tile.id === 'b')!.y).toBeGreaterThanOrEqual(9);
  });

  it('compacts tiles vertically after rearrangement', () => {
    const layout = [
      item('a', 0, 0, 18, 4),
      item('b', 0, 8, 18, 4),
    ];

    const result = applyTileLayoutChange(layout, 'b', { y: 4 });

    expect(layoutHasOverlaps(result)).toBeFalse();
    expect(result.find((tile) => tile.id === 'b')!.y).toBe(4);
  });
});
