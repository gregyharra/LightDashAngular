import { FieldId, MetricQuery } from './explore.model';

export type ChartType =
  | 'cartesian'
  | 'pie'
  | 'table'
  | 'big_number'
  | 'funnel'
  | 'treemap'
  | 'gauge'
  | 'sankey'
  | 'map'
  | 'custom'
  | 'data_app_viz';

export type ChartKind =
  | 'vertical_bar'
  | 'horizontal_bar'
  | 'line'
  | 'area'
  | 'scatter'
  | 'pie'
  | 'table'
  | 'big_number'
  | 'funnel'
  | 'treemap'
  | 'gauge'
  | 'sankey';

export type SavedChartBasic = {
  uuid: string;
  name: string;
  description?: string;
  spaceUuid: string;
  spaceName: string;
  projectUuid: string;
  updatedAt: string;
  pinnedListUuid: string | null;
  pinnedListOrder: number | null;
  views: number;
  firstViewedAt: string;
  isPrivate: boolean;
  access: unknown[];
  chartKind: ChartKind;
  tableName: string;
};

export type ChartStackMode = 'none' | 'stack' | 'percent';

export type ChartLegendPlacement = 'chart' | 'outside-right' | 'outside-left';

/** Shared display fields still edited by today's panel */
export type ChartDisplayConfig = {
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  showGridX: boolean;
  showGridY: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
  flipAxes: boolean;
  stackMode: ChartStackMode;
  rowLimit: number;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  showTableNames: boolean;
  showColumnTotals: boolean;
  seriesColor?: string;
  showValueLabels?: boolean;
};

export type BigNumberComparison = {
  label: string;
  direction: 'up' | 'down' | 'neutral';
};

export const DEFAULT_CHART_DISPLAY_CONFIG: ChartDisplayConfig = {
  showLegend: true,
  legendPlacement: 'chart',
  showGridX: true,
  showGridY: true,
  showXAxis: true,
  showYAxis: true,
  xAxisLabel: '',
  yAxisLabel: '',
  flipAxes: false,
  stackMode: 'none',
  rowLimit: 500,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
  showTableNames: true,
  showColumnTotals: false,
};


export type CartesianLayoutConfig = {
  xField?: FieldId;
  yFields?: FieldId[];
  /** Distinguishes line vs bar kinds on the same cartesian family config. */
  cartesianKind?: Extract<
    ChartKind,
    'vertical_bar' | 'horizontal_bar' | 'line' | 'area' | 'scatter'
  >;
  flipAxes: boolean;
  stackMode: ChartStackMode;
  showGridX: boolean;
  showGridY: boolean;
  showXAxis: boolean;
  showYAxis: boolean;
  xAxisLabel: string;
  yAxisLabel: string;
};

export type CartesianChartConfigBody = {
  layout: CartesianLayoutConfig;
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
  seriesColor?: string;
  showValueLabels?: boolean;
};

export type PieChartConfigBody = {
  xField?: FieldId;
  yField?: FieldId;
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type TableChartConfigBody = {
  showTableNames: boolean;
  showColumnTotals: boolean;
  rowLimit: number;
};

export type BigNumberChartConfigBody = {
  selectedField?: FieldId;
  rowLimit: number;
};

export type FunnelChartConfigBody = {
  fieldId?: FieldId;
  labelFieldId?: FieldId;
  dataInput: 'column' | 'row';
  showLegend: boolean;
  legendPlacement: ChartLegendPlacement;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type TreemapChartConfigBody = {
  dimensionFieldIds: FieldId[];
  metricFieldId?: FieldId;
  showLegend: boolean;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type GaugeChartConfigBody = {
  selectedField?: FieldId;
  min?: number;
  max?: number;
  showLabel: boolean;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type SankeyChartConfigBody = {
  sourceFieldId?: FieldId;
  targetFieldId?: FieldId;
  weightFieldId?: FieldId;
  showNodeLabels: boolean;
  rowLimit: number;
  margins: ChartDisplayConfig['margins'];
};

export type ChartConfig =
  | { type: 'cartesian'; config: CartesianChartConfigBody }
  | { type: 'pie'; config: PieChartConfigBody }
  | { type: 'table'; config: TableChartConfigBody }
  | { type: 'big_number'; config: BigNumberChartConfigBody }
  | { type: 'funnel'; config: FunnelChartConfigBody }
  | { type: 'treemap'; config: TreemapChartConfigBody }
  | { type: 'gauge'; config: GaugeChartConfigBody }
  | { type: 'sankey'; config: SankeyChartConfigBody };

const ACTIVE_CHART_TYPES = new Set<ChartType>([
  'cartesian',
  'pie',
  'table',
  'big_number',
  'funnel',
  'treemap',
  'gauge',
  'sankey',
]);

const LEGACY_CARTESIAN_KINDS = new Set<ChartKind>([
  'vertical_bar',
  'horizontal_bar',
  'line',
  'area',
  'scatter',
]);

type LegacyChartConfig = {
  type: ChartKind;
  xField?: FieldId;
  yField?: FieldId;
  yFields?: FieldId[];
  displayConfig?: Partial<ChartDisplayConfig>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function defaultCartesianLayout(): CartesianLayoutConfig {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    flipAxes: d.flipAxes,
    stackMode: d.stackMode,
    showGridX: d.showGridX,
    showGridY: d.showGridY,
    showXAxis: d.showXAxis,
    showYAxis: d.showYAxis,
    xAxisLabel: d.xAxisLabel,
    yAxisLabel: d.yAxisLabel,
  };
}

function defaultCartesianConfig(): CartesianChartConfigBody {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    layout: defaultCartesianLayout(),
    showLegend: d.showLegend,
    legendPlacement: d.legendPlacement,
    rowLimit: d.rowLimit,
    margins: { ...d.margins },
  };
}

function defaultPieConfig(): PieChartConfigBody {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    showLegend: d.showLegend,
    legendPlacement: d.legendPlacement,
    rowLimit: d.rowLimit,
    margins: { ...d.margins },
  };
}

function defaultTableConfig(): TableChartConfigBody {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    showTableNames: d.showTableNames,
    showColumnTotals: d.showColumnTotals,
    rowLimit: d.rowLimit,
  };
}

function defaultBigNumberConfig(): BigNumberChartConfigBody {
  return {
    rowLimit: DEFAULT_CHART_DISPLAY_CONFIG.rowLimit,
  };
}

function defaultFunnelConfig(): FunnelChartConfigBody {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    dataInput: 'column',
    showLegend: d.showLegend,
    legendPlacement: d.legendPlacement,
    rowLimit: d.rowLimit,
    margins: { ...d.margins },
  };
}

function defaultTreemapConfig(): TreemapChartConfigBody {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    dimensionFieldIds: [],
    showLegend: d.showLegend,
    rowLimit: d.rowLimit,
    margins: { ...d.margins },
  };
}

function defaultGaugeConfig(): GaugeChartConfigBody {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    showLabel: true,
    rowLimit: d.rowLimit,
    margins: { ...d.margins },
  };
}

function defaultSankeyConfig(): SankeyChartConfigBody {
  const d = DEFAULT_CHART_DISPLAY_CONFIG;
  return {
    showNodeLabels: true,
    rowLimit: d.rowLimit,
    margins: { ...d.margins },
  };
}

export function defaultConfigForType(type: ChartType): ChartConfig {
  switch (type) {
    case 'cartesian':
      return { type: 'cartesian', config: defaultCartesianConfig() };
    case 'pie':
      return { type: 'pie', config: defaultPieConfig() };
    case 'big_number':
      return { type: 'big_number', config: defaultBigNumberConfig() };
    case 'funnel':
      return { type: 'funnel', config: defaultFunnelConfig() };
    case 'treemap':
      return { type: 'treemap', config: defaultTreemapConfig() };
    case 'gauge':
      return { type: 'gauge', config: defaultGaugeConfig() };
    case 'sankey':
      return { type: 'sankey', config: defaultSankeyConfig() };
    case 'table':
    case 'map':
    case 'custom':
    case 'data_app_viz':
    default:
      return { type: 'table', config: defaultTableConfig() };
  }
}

function mergeCartesianConfig(
  partial: Partial<Omit<CartesianChartConfigBody, 'layout'>> & {
    layout?: Partial<CartesianLayoutConfig>;
  },
): CartesianChartConfigBody {
  const base = defaultCartesianConfig();
  const layout = { ...base.layout, ...partial.layout };
  return {
    ...base,
    ...partial,
    layout,
  };
}

function migrateLegacyCartesian(legacy: LegacyChartConfig): ChartConfig {
  const display = legacy.displayConfig ?? {};
  const yFields =
    legacy.yFields ??
    (legacy.yField !== undefined ? [legacy.yField] : undefined);

  const layout: Partial<CartesianLayoutConfig> = {
    xField: legacy.xField,
    yFields,
  };
  if (LEGACY_CARTESIAN_KINDS.has(legacy.type)) {
    layout.cartesianKind = legacy.type as Extract<
      ChartKind,
      'vertical_bar' | 'horizontal_bar' | 'line' | 'area' | 'scatter'
    >;
  }
  if (legacy.type === 'horizontal_bar') {
    layout.flipAxes = true;
  } else if (legacy.type === 'vertical_bar') {
    layout.flipAxes = false;
  } else if (display.flipAxes !== undefined) {
    layout.flipAxes = display.flipAxes;
  }
  if (display.stackMode !== undefined) layout.stackMode = display.stackMode;
  if (display.showGridX !== undefined) layout.showGridX = display.showGridX;
  if (display.showGridY !== undefined) layout.showGridY = display.showGridY;
  if (display.showXAxis !== undefined) layout.showXAxis = display.showXAxis;
  if (display.showYAxis !== undefined) layout.showYAxis = display.showYAxis;
  if (display.xAxisLabel !== undefined) layout.xAxisLabel = display.xAxisLabel;
  if (display.yAxisLabel !== undefined) layout.yAxisLabel = display.yAxisLabel;

  const body: Partial<Omit<CartesianChartConfigBody, 'layout'>> & {
    layout?: Partial<CartesianLayoutConfig>;
  } = { layout };
  if (display.showLegend !== undefined) body.showLegend = display.showLegend;
  if (display.legendPlacement !== undefined) {
    body.legendPlacement = display.legendPlacement;
  }
  if (display.rowLimit !== undefined) body.rowLimit = display.rowLimit;
  if (display.margins !== undefined) body.margins = display.margins;
  if (display.seriesColor !== undefined) body.seriesColor = display.seriesColor;
  if (display.showValueLabels !== undefined) {
    body.showValueLabels = display.showValueLabels;
  }

  return { type: 'cartesian', config: mergeCartesianConfig(body) };
}

function migrateLegacyPie(legacy: LegacyChartConfig): ChartConfig {
  const display = legacy.displayConfig ?? {};
  const base = defaultPieConfig();
  return {
    type: 'pie',
    config: {
      ...base,
      xField: legacy.xField,
      yField: legacy.yField ?? legacy.yFields?.[0],
      showLegend: display.showLegend ?? base.showLegend,
      legendPlacement: display.legendPlacement ?? base.legendPlacement,
      rowLimit: display.rowLimit ?? base.rowLimit,
      margins: display.margins ?? base.margins,
    },
  };
}

function migrateLegacyTable(legacy: LegacyChartConfig): ChartConfig {
  const display = legacy.displayConfig ?? {};
  const base = defaultTableConfig();
  return {
    type: 'table',
    config: {
      showTableNames: display.showTableNames ?? base.showTableNames,
      showColumnTotals: display.showColumnTotals ?? base.showColumnTotals,
      rowLimit: display.rowLimit ?? base.rowLimit,
    },
  };
}

function migrateLegacyBigNumber(legacy: LegacyChartConfig): ChartConfig {
  const display = legacy.displayConfig ?? {};
  const base = defaultBigNumberConfig();
  return {
    type: 'big_number',
    config: {
      selectedField: legacy.yField ?? legacy.xField ?? legacy.yFields?.[0],
      rowLimit: display.rowLimit ?? base.rowLimit,
    },
  };
}

function isLegacyChartConfig(raw: Record<string, unknown>): raw is LegacyChartConfig {
  const type = raw['type'];
  if (typeof type !== 'string' || isNormalizedChartConfig(raw)) {
    return false;
  }
  return (
    type === 'vertical_bar' ||
    type === 'horizontal_bar' ||
    type === 'line' ||
    type === 'area' ||
    type === 'scatter' ||
    type === 'pie' ||
    type === 'table' ||
    type === 'big_number'
  );
}

function isNormalizedChartConfig(raw: Record<string, unknown>): boolean {
  const type = raw['type'];
  return (
    typeof type === 'string' &&
    ACTIVE_CHART_TYPES.has(type as ChartType) &&
    isRecord(raw['config'])
  );
}

function normalizeActiveFamily(raw: Record<string, unknown>): ChartConfig {
  const type = raw['type'] as ChartType;
  const config = raw['config'] as Record<string, unknown>;

  switch (type) {
    case 'cartesian': {
      const partial = config as Partial<Omit<CartesianChartConfigBody, 'layout'>> & {
        layout?: Partial<CartesianLayoutConfig>;
      };
      return {
        type: 'cartesian',
        config: mergeCartesianConfig(partial),
      };
    }
    case 'pie': {
      const base = defaultPieConfig();
      const partial = config as Partial<PieChartConfigBody>;
      return {
        type: 'pie',
        config: { ...base, ...partial },
      };
    }
    case 'table': {
      const base = defaultTableConfig();
      const partial = config as Partial<TableChartConfigBody>;
      return {
        type: 'table',
        config: { ...base, ...partial },
      };
    }
    case 'big_number': {
      const base = defaultBigNumberConfig();
      const partial = config as Partial<BigNumberChartConfigBody>;
      return {
        type: 'big_number',
        config: { ...base, ...partial },
      };
    }
    case 'funnel': {
      const base = defaultFunnelConfig();
      const partial = config as Partial<FunnelChartConfigBody>;
      return {
        type: 'funnel',
        config: { ...base, ...partial },
      };
    }
    case 'treemap': {
      const base = defaultTreemapConfig();
      const partial = config as Partial<TreemapChartConfigBody>;
      return {
        type: 'treemap',
        config: { ...base, ...partial },
      };
    }
    case 'gauge': {
      const base = defaultGaugeConfig();
      const partial = config as Partial<GaugeChartConfigBody>;
      return {
        type: 'gauge',
        config: { ...base, ...partial },
      };
    }
    case 'sankey': {
      const base = defaultSankeyConfig();
      const partial = config as Partial<SankeyChartConfigBody>;
      return {
        type: 'sankey',
        config: { ...base, ...partial },
      };
    }
    default:
      return defaultConfigForType('table');
  }
}

export function normalizeChartConfig(raw: unknown): ChartConfig {
  if (!isRecord(raw)) {
    return defaultConfigForType('cartesian');
  }

  if (isNormalizedChartConfig(raw)) {
    return normalizeActiveFamily(raw);
  }

  if (isLegacyChartConfig(raw)) {
    if (LEGACY_CARTESIAN_KINDS.has(raw.type)) {
      return migrateLegacyCartesian(raw);
    }
    switch (raw.type) {
      case 'pie':
        return migrateLegacyPie(raw);
      case 'table':
        return migrateLegacyTable(raw);
      case 'big_number':
        return migrateLegacyBigNumber(raw);
    }
  }

  const type = raw['type'];
  if (typeof type === 'string' && !ACTIVE_CHART_TYPES.has(type as ChartType)) {
    return defaultConfigForType('table');
  }

  return defaultConfigForType('cartesian');
}

export type SavedChart = SavedChartBasic & {
  tableName: string;
  metricQuery: MetricQuery;
  chartConfig: ChartConfig;
  updatedByUser: {
    userUuid: string;
    firstName: string;
    lastName: string;
  };
};

export type CreateSavedChartPayload = {
  name: string;
  description?: string;
  spaceUuid?: string;
  tableName: string;
  chartKind: ChartKind;
  metricQuery: MetricQuery;
  chartConfig: ChartConfig;
};

export type UpdateSavedChartPayload = {
  name?: string;
  description?: string;
  spaceUuid?: string;
  tableName?: string;
  chartKind?: ChartKind;
  metricQuery?: MetricQuery;
  chartConfig?: ChartConfig;
};
