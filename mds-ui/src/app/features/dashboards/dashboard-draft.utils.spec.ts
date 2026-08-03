import {
  DashboardConfig,
  DashboardChartTile,
  DashboardDimensionFilter,
  DashboardTab,
  DashboardTileTypes,
} from '../../core/models/dashboard.model';
import {
  DashboardDraftState,
  isDashboardDraftDirty,
} from './dashboard-draft.utils';

const tab: DashboardTab = {
  uuid: 'tab-1',
  name: 'Main',
  order: 0,
};

const tile: DashboardChartTile = {
  uuid: 'tile-1',
  type: DashboardTileTypes.SAVED_CHART,
  x: 0,
  y: 0,
  w: 18,
  h: 9,
  tabUuid: 'tab-1',
  properties: {
    savedChartUuid: 'chart-1',
  },
};

const filter: DashboardDimensionFilter = {
  id: 'filter-1',
  label: 'Status',
  operator: 'equals',
  target: {
    fieldId: 'orders_status',
    tableName: 'orders',
  },
  values: ['completed'],
};

const config: DashboardConfig = {
  isDateZoomDisabled: false,
  defaultDateZoomGranularity: 'Month',
};

function createState(
  overrides: Partial<DashboardDraftState> = {},
): DashboardDraftState {
  return {
    name: 'Sales dashboard',
    description: 'Overview',
    tabs: [{ ...tab }],
    tiles: [{ ...tile, properties: { ...tile.properties } }],
    filters: [{ ...filter, target: { ...filter.target }, values: [...filter.values] }],
    config: { ...config },
    ...overrides,
  };
}

describe('isDashboardDraftDirty', () => {
  it('returns false when baseline and draft are identical', () => {
    const baseline = createState();
    const draft = createState();

    expect(isDashboardDraftDirty(baseline, draft)).toBeFalse();
  });

  it('returns true when name changes', () => {
    const baseline = createState();
    const draft = createState({ name: 'Renamed dashboard' });

    expect(isDashboardDraftDirty(baseline, draft)).toBeTrue();
  });

  it('returns true when description changes', () => {
    const baseline = createState();
    const draft = createState({ description: 'Updated overview' });

    expect(isDashboardDraftDirty(baseline, draft)).toBeTrue();
  });

  it('returns true when tabs change', () => {
    const baseline = createState();
    const draft = createState({
      tabs: [{ ...tab, name: 'Renamed tab' }],
    });

    expect(isDashboardDraftDirty(baseline, draft)).toBeTrue();
  });

  it('returns true when tiles change', () => {
    const baseline = createState();
    const draft = createState({
      tiles: [{ ...tile, x: 18, properties: { ...tile.properties } }],
    });

    expect(isDashboardDraftDirty(baseline, draft)).toBeTrue();
  });

  it('returns true when dimension filters change', () => {
    const baseline = createState();
    const draft = createState({
      filters: [{ ...filter, values: ['pending'] }],
    });

    expect(isDashboardDraftDirty(baseline, draft)).toBeTrue();
  });

  it('returns true when persisted config changes', () => {
    const baseline = createState();
    const draft = createState({
      config: { ...config, isDateZoomDisabled: true },
    });

    expect(isDashboardDraftDirty(baseline, draft)).toBeTrue();
  });

  it('returns true when config is added to a baseline without config', () => {
    const baseline = createState({ config: undefined });
    const draft = createState({ config: { ...config } });

    expect(isDashboardDraftDirty(baseline, draft)).toBeTrue();
  });

  it('returns false when both baseline and draft omit config', () => {
    const baseline = createState({ config: undefined });
    const draft = createState({ config: undefined });

    expect(isDashboardDraftDirty(baseline, draft)).toBeFalse();
  });
});
