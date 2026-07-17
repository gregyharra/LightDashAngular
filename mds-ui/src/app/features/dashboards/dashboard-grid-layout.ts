import {
  clampTilePosition,
  DashboardTilePosition,
  DASHBOARD_GRID_COLS,
} from './dashboard-grid.constants';

export type GridLayoutItem = DashboardTilePosition & { id: string };

export function tilesCollide(
  a: DashboardTilePosition,
  b: DashboardTilePosition,
): boolean {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h
  );
}

function getCollisions(
  item: DashboardTilePosition,
  layout: GridLayoutItem[],
  excludeId?: string,
): GridLayoutItem[] {
  return layout.filter(
    (other) => other.id !== excludeId && tilesCollide(item, other),
  );
}

function getFirstCollision(
  item: DashboardTilePosition,
  layout: GridLayoutItem[],
  excludeId?: string,
): GridLayoutItem | null {
  return getCollisions(item, layout, excludeId)[0] ?? null;
}

function compactItemVertical(
  item: GridLayoutItem,
  layout: GridLayoutItem[],
): GridLayoutItem {
  const compacted = { ...item };

  while (compacted.y > 0) {
    const test = { ...compacted, y: compacted.y - 1 };
    if (getFirstCollision(test, layout, compacted.id)) {
      break;
    }
    compacted.y--;
  }

  return compacted;
}

function moveElementAwayFromCollisionVertical(
  layout: GridLayoutItem[],
  itemToMove: GridLayoutItem,
  collidesWith: GridLayoutItem,
): void {
  itemToMove.y = collidesWith.y + collidesWith.h;
  itemToMove.x = Math.max(
    0,
    Math.min(itemToMove.x, DASHBOARD_GRID_COLS - itemToMove.w),
  );

  const collisions = getCollisions(itemToMove, layout, itemToMove.id);
  for (const collision of collisions) {
    if (collision.id === collidesWith.id) {
      continue;
    }
    moveElementAwayFromCollisionVertical(layout, collision, itemToMove);
  }
}

function moveElement(
  layout: GridLayoutItem[],
  itemId: string,
  x: number,
  y: number,
): void {
  const item = layout.find((entry) => entry.id === itemId);
  if (!item) {
    return;
  }

  item.x = x;
  item.y = y;

  const compacted = compactItemVertical(item, layout);
  item.x = compacted.x;
  item.y = compacted.y;

  const collisions = getCollisions(item, layout, item.id);
  for (const collision of collisions) {
    moveElementAwayFromCollisionVertical(layout, collision, item);
  }

  const compactedAgain = compactItemVertical(item, layout);
  item.x = compactedAgain.x;
  item.y = compactedAgain.y;
}

function sortLayoutItemsByReadingOrder(
  layout: GridLayoutItem[],
): GridLayoutItem[] {
  return [...layout].sort((a, b) => {
    if (a.y !== b.y) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });
}

function compactLayoutVertical(layout: GridLayoutItem[]): void {
  const sorted = sortLayoutItemsByReadingOrder(layout);
  const placed: GridLayoutItem[] = [];

  for (const item of sorted) {
    const compacted = compactItemVertical(item, placed);
    const index = layout.findIndex((entry) => entry.id === item.id);
    layout[index] = compacted;
    placed.push(compacted);
  }
}

function resolveCollisionsForItem(
  layout: GridLayoutItem[],
  item: GridLayoutItem,
): void {
  const collisions = getCollisions(item, layout, item.id);
  for (const collision of collisions) {
    moveElementAwayFromCollisionVertical(layout, collision, item);
  }
}

export function applyTileLayoutChange(
  items: GridLayoutItem[],
  changedId: string,
  newPosition: Partial<DashboardTilePosition>,
): GridLayoutItem[] {
  const layout = items.map((item) => ({ ...item }));
  const changed = layout.find((item) => item.id === changedId);
  if (!changed) {
    return items;
  }

  const nextPosition = clampTilePosition({
    x: changed.x,
    y: changed.y,
    w: changed.w,
    h: changed.h,
    ...newPosition,
  });

  const isResize =
    newPosition.w !== undefined || newPosition.h !== undefined;

  if (isResize) {
    changed.x = nextPosition.x;
    changed.y = nextPosition.y;
    changed.w = nextPosition.w;
    changed.h = nextPosition.h;
    resolveCollisionsForItem(layout, changed);
  } else {
    moveElement(layout, changedId, nextPosition.x, nextPosition.y);
  }

  compactLayoutVertical(layout);

  return layout;
}

export function layoutHasOverlaps(items: GridLayoutItem[]): boolean {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (tilesCollide(items[i], items[j])) {
        return true;
      }
    }
  }
  return false;
}
