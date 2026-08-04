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
  PieChartConfigBody,
  TableChartConfigBody,
  defaultConfigForType,
} from './chart.model';

export type ChartConfigCache = Partial<Record<ChartType, ChartConfig>>;

export type ChartPanelView = {
  chartKind: ChartKind;
  xField: FieldId | null;
  yFields: FieldId[];
  displayConfig: ChartDisplayConfig;
};

type CartesianKind = Extract<ChartKind, 'vertical_bar' | 'horizontal_bar' | 'line'>;

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
]);

function cloneChartConfig(config: ChartConfig): ChartConfig {
  return structuredClone(config);
}

function isCartesianKind(kind: ChartKind): kind is CartesianKind {
  return CARTESIAN_KINDS.has(kind as CartesianKind);
}

function flipAxesForCartesianKind(kind: CartesianKind): boolean {
  return kind === 'horizontal_bar';
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

export function chartTypeFromKind(kind: ChartKind): ChartType {
  switch (kind) {
    case 'vertical_bar':
    case 'horizontal_bar':
    case 'line':
      return 'cartesian';
    case 'pie':
      return 'pie';
    case 'big_number':
      return 'big_number';
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
  layout.cartesianKind = kind;
  layout.flipAxes = flipAxesForCartesianKind(kind);
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
  }
}

export function applyChartPanelPatch(
  current: ChartConfig,
  patch: Partial<ChartDisplayConfig> & {
    xField?: FieldId | null;
    yFields?: FieldId[];
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
  }
}
