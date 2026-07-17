export const DASHBOARD_GRID_COLS = 36;
export const DASHBOARD_GRID_ROW_HEIGHT_PX = 55;
export const DASHBOARD_GRID_GAP_PX = 10;

export type DashboardTilePosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function getGridColumnWidth(gridWidth: number): number {
  return (
    (gridWidth - (DASHBOARD_GRID_COLS - 1) * DASHBOARD_GRID_GAP_PX) /
    DASHBOARD_GRID_COLS
  );
}

export function getGridColumnUnit(gridWidth: number): number {
  return getGridColumnWidth(gridWidth) + DASHBOARD_GRID_GAP_PX;
}

export function getGridRowUnit(): number {
  return DASHBOARD_GRID_ROW_HEIGHT_PX + DASHBOARD_GRID_GAP_PX;
}

export function pixelDeltaToGridDelta(
  deltaX: number,
  deltaY: number,
  gridWidth: number,
): { dx: number; dy: number } {
  return {
    dx: Math.round(deltaX / getGridColumnUnit(gridWidth)),
    dy: Math.round(deltaY / getGridRowUnit()),
  };
}

export function clampTilePosition(position: DashboardTilePosition): DashboardTilePosition {
  const w = Math.max(1, Math.min(position.w, DASHBOARD_GRID_COLS));
  const h = Math.max(1, position.h);
  const x = Math.max(0, Math.min(position.x, DASHBOARD_GRID_COLS - w));
  const y = Math.max(0, position.y);

  return { x, y, w, h };
}
