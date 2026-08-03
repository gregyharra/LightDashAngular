import {
  DashboardConfig,
  DashboardDimensionFilter,
  DashboardTab,
  DashboardTile,
} from '../../core/models/dashboard.model';

export type DashboardDraftState = {
  name: string;
  description: string;
  tabs: DashboardTab[];
  tiles: DashboardTile[];
  filters: DashboardDimensionFilter[];
  config?: DashboardConfig;
};

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function isDashboardDraftDirty(
  baseline: DashboardDraftState,
  draft: DashboardDraftState,
): boolean {
  if (baseline.name !== draft.name) {
    return true;
  }

  if (baseline.description !== draft.description) {
    return true;
  }

  if (!deepEqual(baseline.tabs, draft.tabs)) {
    return true;
  }

  if (!deepEqual(baseline.tiles, draft.tiles)) {
    return true;
  }

  if (!deepEqual(baseline.filters, draft.filters)) {
    return true;
  }

  if (!deepEqual(baseline.config, draft.config)) {
    return true;
  }

  return false;
}
