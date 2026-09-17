import { FieldId } from './explore.model';
import {
  BigNumberChartConfigBody,
  CartesianChartConfigBody,
  CartesianLayoutConfig,
  ChartConfig,
  ChartDisplayConfig,
  ChartKind,
  ChartType,
  DEFAULT_CHART_DISPLAY_CONFIG,
  FunnelChartConfigBody,
  GaugeChartConfigBody,
  PieChartConfigBody,
  SankeyChartConfigBody,
  TableChartConfigBody,
  TreemapChartConfigBody,
  defaultConfigForType,
} from './chart.model';

export type ChartConfigCache = Partial<Record<ChartType, ChartConfig>>;

export type ChartPanelView = {
  chartKind: ChartKind;
  xField: FieldId | null;
  yFields: FieldId[];
  displayConfig: ChartDisplayConfig;
  funnelDataInput?: 'column' | 'row';
  treemapDimensionFieldIds?: FieldId[];
  gaugeMin?: number;
  gaugeMax?: number;
  sankeySourceFieldId?: FieldId | null;
  sankeyTargetFieldId?: FieldId | null;
  sankeyWeightFieldId?: FieldId | null;
  showNodeLabels?: boolean;
  showGaugeLabel?: boolean;
};

type CartesianKind = Extract<
  ChartKind,
  'vertical_bar' | 'horizontal_bar' | 'line' | 'area' | 'scatter'
>;

function cartesianKindFromLayout(layout: CartesianLayoutConfig): CartesianKind {
  if (layout.cartesianKind) {
    return layout.cartesianKind;
  }
  return layout.flipAxes ? 'horizontal_bar' : 'vertical_bar';
}

const CARTESIAN_KINDS = new Set<CartesianKind>([
  'vertical_bar',
  'horizontal_bar',
  'line',
  'area',
  'scatter',
]);

function cloneChartConfig(config: ChartConfig): ChartConfig {
  return structuredClone(config);
}

function isCartesianKind(kind: ChartKind): kind is CartesianKind {
  return CARTESIAN_KINDS.has(kind as CartesianKind);
}

function flipAxesForCartesianKind(kind: CartesianKind, previousFlipAxes?: boolean): boolean {
  if (kind === 'horizontal_bar') {
    return true;
  }
  if (kind === 'vertical_bar') {
    return false;
  }
  // area/scatter default to unflipped axes, but preserve a flip that
  // already existed on the layout (e.g. restored from cache).
  return previousFlipAxes ?? false;
}

function displayConfigFromCartesian(config: CartesianChartConfigBody): ChartDisplayConfig {
  const layout = config.layout;
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    showLegend: config.showLegend,
    legendPlacement: config.legendPlacement,
    rowLimit: config.rowLimit,
    margins: { ...config.margins },
    seriesColor: config.seriesColor,
    showValueLabels: config.showValueLabels,
    flipAxes: layout.flipAxes,
    stackMode: layout.stackMode,
    showGridX: layout.showGridX,
    showGridY: layout.showGridY,
    showXAxis: layout.showXAxis,
    showYAxis: layout.showYAxis,
    xAxisLabel: layout.xAxisLabel,
    yAxisLabel: layout.yAxisLabel,
  };
}

function displayConfigFromPie(config: PieChartConfigBody): ChartDisplayConfig {
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    showLegend: config.showLegend,
    legendPlacement: config.legendPlacement,
    rowLimit: config.rowLimit,
    margins: { ...config.margins },
  };
}

function displayConfigFromTable(config: TableChartConfigBody): ChartDisplayConfig {
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    showTableNames: config.showTableNames,
    showColumnTotals: config.showColumnTotals,
    rowLimit: config.rowLimit,
  };
}

function displayConfigFromBigNumber(config: BigNumberChartConfigBody): ChartDisplayConfig {
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    rowLimit: config.rowLimit,
  };
}

function displayConfigFromFunnel(config: FunnelChartConfigBody): ChartDisplayConfig {
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    showLegend: config.showLegend,
    legendPlacement: config.legendPlacement,
    rowLimit: config.rowLimit,
    margins: { ...config.margins },
  };
}

function displayConfigFromTreemap(config: TreemapChartConfigBody): ChartDisplayConfig {
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    showLegend: config.showLegend,
    rowLimit: config.rowLimit,
    margins: { ...config.margins },
  };
}

function displayConfigFromGauge(config: GaugeChartConfigBody): ChartDisplayConfig {
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    rowLimit: config.rowLimit,
    margins: { ...config.margins },
  };
}

function displayConfigFromSankey(config: SankeyChartConfigBody): ChartDisplayConfig {
  return {
    ...DEFAULT_CHART_DISPLAY_CONFIG,
    rowLimit: config.rowLimit,
    margins: { ...config.margins },
  };
}

export function chartTypeFromKind(kind: ChartKind): ChartType {
  switch (kind) {
    case 'vertical_bar':
    case 'horizontal_bar':
    case 'line':
    case 'area':
    case 'scatter':
      return 'cartesian';
    case 'pie':
      return 'pie';
    case 'big_number':
      return 'big_number';
    case 'funnel':
      return 'funnel';
    case 'treemap':
      return 'treemap';
    case 'gauge':
      return 'gauge';
    case 'sankey':
      return 'sankey';
    case 'table':
    default:
      return 'table';
  }
}

export function chartKindFromConfig(config: ChartConfig): ChartKind {
  switch (config.type) {
    case 'cartesian':
      return cartesianKindFromLayout(config.config.layout);
    case 'pie':
      return 'pie';
    case 'table':
      return 'table';
    case 'big_number':
      return 'big_number';
    case 'funnel':
      return 'funnel';
    case 'treemap':
      return 'treemap';
    case 'gauge':
      return 'gauge';
    case 'sankey':
      return 'sankey';
  }
}

export function getValidChartConfig(
  type: ChartType,
  cache: ChartConfigCache = {},
  incoming?: ChartConfig,
): ChartConfig {
  if (incoming?.type === type) {
    return cloneChartConfig(incoming);
  }

  const cached = cache[type];
  if (cached?.type === type) {
    return cloneChartConfig(cached);
  }

  return defaultConfigForType(type);
}

function applyCartesianKind(config: ChartConfig, kind: CartesianKind): ChartConfig {
  if (config.type !== 'cartesian') {
    return config;
  }

  const next = cloneChartConfig(config);
  if (next.type !== 'cartesian') {
    return next;
  }

  const layout = next.config.layout;
  const previousFlipAxes = layout.flipAxes;
  layout.cartesianKind = kind;
  layout.flipAxes = flipAxesForCartesianKind(kind, previousFlipAxes);
  return next;
}

export function applyChartKindChange(
  current: ChartConfig,
  cache: ChartConfigCache,
  kind: ChartKind,
): { chartConfig: ChartConfig; cache: ChartConfigCache } {
  const nextCache: ChartConfigCache = {
    ...cache,
    [current.type]: cloneChartConfig(current),
  };

  if (
    current.type === 'cartesian' &&
    isCartesianKind(kind) &&
    chartTypeFromKind(kind) === 'cartesian'
  ) {
    return {
      chartConfig: applyCartesianKind(current, kind),
      cache: nextCache,
    };
  }

  const targetType = chartTypeFromKind(kind);
  let chartConfig = getValidChartConfig(targetType, nextCache);

  if (targetType === 'cartesian' && isCartesianKind(kind)) {
    chartConfig = applyCartesianKind(chartConfig, kind);
  }

  return { chartConfig, cache: nextCache };
}

export function toChartPanelView(config: ChartConfig): ChartPanelView {
  const chartKind = chartKindFromConfig(config);

  switch (config.type) {
    case 'cartesian': {
      const layout = config.config.layout;
      return {
        chartKind,
        xField: layout.xField ?? null,
        yFields: [...(layout.yFields ?? [])],
        displayConfig: displayConfigFromCartesian(config.config),
      };
    }
    case 'pie':
      return {
        chartKind,
        xField: config.config.xField ?? null,
        yFields: config.config.yField ? [config.config.yField] : [],
        displayConfig: displayConfigFromPie(config.config),
      };
    case 'table':
      return {
        chartKind,
        xField: null,
        yFields: [],
        displayConfig: displayConfigFromTable(config.config),
      };
    case 'big_number':
      return {
        chartKind,
        xField: null,
        yFields: config.config.selectedField ? [config.config.selectedField] : [],
        displayConfig: displayConfigFromBigNumber(config.config),
      };
    case 'funnel':
      return {
        chartKind,
        xField: config.config.fieldId ?? null,
        yFields: config.config.labelFieldId ? [config.config.labelFieldId] : [],
        displayConfig: displayConfigFromFunnel(config.config),
        funnelDataInput: config.config.dataInput,
      };
    case 'treemap':
      return {
        chartKind,
        xField: null,
        yFields: config.config.metricFieldId ? [config.config.metricFieldId] : [],
        displayConfig: displayConfigFromTreemap(config.config),
        treemapDimensionFieldIds: [...config.config.dimensionFieldIds],
      };
    case 'gauge':
      return {
        chartKind,
        xField: null,
        yFields: config.config.selectedField ? [config.config.selectedField] : [],
        displayConfig: displayConfigFromGauge(config.config),
        gaugeMin: config.config.min,
        gaugeMax: config.config.max,
        showGaugeLabel: config.config.showLabel,
      };
    case 'sankey':
      return {
        chartKind,
        xField: null,
        yFields: [],
        displayConfig: displayConfigFromSankey(config.config),
        sankeySourceFieldId: config.config.sourceFieldId ?? null,
        sankeyTargetFieldId: config.config.targetFieldId ?? null,
        sankeyWeightFieldId: config.config.weightFieldId ?? null,
        showNodeLabels: config.config.showNodeLabels,
      };
  }
}

export function applyChartPanelPatch(
  current: ChartConfig,
  patch: Partial<ChartDisplayConfig> & {
    xField?: FieldId | null;
    yFields?: FieldId[];
    funnelDataInput?: 'column' | 'row';
    treemapDimensionFieldIds?: FieldId[];
    gaugeMin?: number;
    gaugeMax?: number;
    sankeySourceFieldId?: FieldId | null;
    sankeyTargetFieldId?: FieldId | null;
    sankeyWeightFieldId?: FieldId | null;
    showNodeLabels?: boolean;
    showGaugeLabel?: boolean;
  },
): ChartConfig {
  const next = cloneChartConfig(current);

  switch (next.type) {
    case 'cartesian': {
      const body = next.config;
      const layout = body.layout;
      const {
        xField,
        yFields,
        flipAxes,
        stackMode,
        showGridX,
        showGridY,
        showXAxis,
        showYAxis,
        xAxisLabel,
        yAxisLabel,
        showLegend,
        legendPlacement,
        rowLimit,
        margins,
        seriesColor,
        showValueLabels,
        showTableNames: _showTableNames,
        showColumnTotals: _showColumnTotals,
        funnelDataInput: _funnelDataInput,
        treemapDimensionFieldIds: _treemapDimensionFieldIds,
        gaugeMin: _gaugeMin,
        gaugeMax: _gaugeMax,
        sankeySourceFieldId: _sankeySourceFieldId,
        sankeyTargetFieldId: _sankeyTargetFieldId,
        sankeyWeightFieldId: _sankeyWeightFieldId,
        showNodeLabels: _showNodeLabels,
        showGaugeLabel: _showGaugeLabel,
        ...rest
      } = patch;

      if (xField !== undefined) {
        layout.xField = xField ?? undefined;
      }
      if (yFields !== undefined) {
        layout.yFields = yFields;
      }
      if (flipAxes !== undefined) {
        layout.flipAxes = flipAxes;
        const kind = layout.cartesianKind ?? cartesianKindFromLayout(layout);
        if (kind === 'vertical_bar' || kind === 'horizontal_bar') {
          layout.cartesianKind = flipAxes ? 'horizontal_bar' : 'vertical_bar';
        }
      }
      if (stackMode !== undefined) layout.stackMode = stackMode;
      if (showGridX !== undefined) layout.showGridX = showGridX;
      if (showGridY !== undefined) layout.showGridY = showGridY;
      if (showXAxis !== undefined) layout.showXAxis = showXAxis;
      if (showYAxis !== undefined) layout.showYAxis = showYAxis;
      if (xAxisLabel !== undefined) layout.xAxisLabel = xAxisLabel;
      if (yAxisLabel !== undefined) layout.yAxisLabel = yAxisLabel;
      if (showLegend !== undefined) body.showLegend = showLegend;
      if (legendPlacement !== undefined) body.legendPlacement = legendPlacement;
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      if (margins !== undefined) body.margins = { ...margins };
      if (seriesColor !== undefined) body.seriesColor = seriesColor;
      if (showValueLabels !== undefined) body.showValueLabels = showValueLabels;
      void rest;
      return next;
    }
    case 'pie': {
      const body = next.config;
      const { xField, yFields, showLegend, legendPlacement, rowLimit, margins } = patch;
      if (xField !== undefined) body.xField = xField ?? undefined;
      if (yFields !== undefined) body.yField = yFields[0];
      if (showLegend !== undefined) body.showLegend = showLegend;
      if (legendPlacement !== undefined) body.legendPlacement = legendPlacement;
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      if (margins !== undefined) body.margins = { ...margins };
      return next;
    }
    case 'table': {
      const body = next.config;
      const { showTableNames, showColumnTotals, rowLimit } = patch;
      if (showTableNames !== undefined) body.showTableNames = showTableNames;
      if (showColumnTotals !== undefined) body.showColumnTotals = showColumnTotals;
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      return next;
    }
    case 'big_number': {
      const body = next.config;
      const { yFields, rowLimit } = patch;
      if (yFields !== undefined) body.selectedField = yFields[0];
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      return next;
    }
    case 'funnel': {
      const body = next.config;
      const { xField, yFields, showLegend, legendPlacement, rowLimit, margins, funnelDataInput } =
        patch;
      if (xField !== undefined) body.fieldId = xField ?? undefined;
      if (yFields !== undefined) body.labelFieldId = yFields[0];
      if (showLegend !== undefined) body.showLegend = showLegend;
      if (legendPlacement !== undefined) body.legendPlacement = legendPlacement;
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      if (margins !== undefined) body.margins = { ...margins };
      if (funnelDataInput !== undefined) body.dataInput = funnelDataInput;
      return next;
    }
    case 'treemap': {
      const body = next.config;
      const { yFields, showLegend, rowLimit, margins, treemapDimensionFieldIds } = patch;
      if (yFields !== undefined) body.metricFieldId = yFields[0];
      if (showLegend !== undefined) body.showLegend = showLegend;
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      if (margins !== undefined) body.margins = { ...margins };
      if (treemapDimensionFieldIds !== undefined) {
        body.dimensionFieldIds = treemapDimensionFieldIds;
      }
      return next;
    }
    case 'gauge': {
      const body = next.config;
      const { yFields, rowLimit, margins, gaugeMin, gaugeMax, showGaugeLabel } = patch;
      if (yFields !== undefined) body.selectedField = yFields[0];
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      if (margins !== undefined) body.margins = { ...margins };
      if (gaugeMin !== undefined) body.min = gaugeMin;
      if (gaugeMax !== undefined) body.max = gaugeMax;
      if (showGaugeLabel !== undefined) body.showLabel = showGaugeLabel;
      return next;
    }
    case 'sankey': {
      const body = next.config;
      const {
        rowLimit,
        margins,
        sankeySourceFieldId,
        sankeyTargetFieldId,
        sankeyWeightFieldId,
        showNodeLabels,
      } = patch;
      if (rowLimit !== undefined) body.rowLimit = rowLimit;
      if (margins !== undefined) body.margins = { ...margins };
      if (sankeySourceFieldId !== undefined) {
        body.sourceFieldId = sankeySourceFieldId ?? undefined;
      }
      if (sankeyTargetFieldId !== undefined) {
        body.targetFieldId = sankeyTargetFieldId ?? undefined;
      }
      if (sankeyWeightFieldId !== undefined) {
        body.weightFieldId = sankeyWeightFieldId ?? undefined;
      }
      if (showNodeLabels !== undefined) body.showNodeLabels = showNodeLabels;
      return next;
    }
  }
}
