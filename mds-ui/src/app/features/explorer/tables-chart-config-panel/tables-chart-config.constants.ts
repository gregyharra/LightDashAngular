import {
  ChartDisplayConfig,
  ChartKind,
  ChartLegendPlacement,
  ChartStackMode,
  DEFAULT_CHART_DISPLAY_CONFIG,
} from '../../../core/models/chart.model';

export type TablesChartTypeOption = {
  value: ChartKind;
  labelKey: string;
  icon: string;
};

export const TABLES_CHART_TYPE_OPTIONS: TablesChartTypeOption[] = [
  { value: 'vertical_bar', labelKey: 'charts.types.verticalBar', icon: 'bar_chart' },
  { value: 'horizontal_bar', labelKey: 'charts.types.horizontalBar', icon: 'align_horizontal_left' },
  { value: 'line', labelKey: 'charts.types.line', icon: 'show_chart' },
  { value: 'area', labelKey: 'charts.types.area', icon: 'area_chart' },
  { value: 'scatter', labelKey: 'charts.types.scatter', icon: 'scatter_plot' },
  { value: 'pie', labelKey: 'charts.types.pie', icon: 'pie_chart' },
  { value: 'funnel', labelKey: 'charts.types.funnel', icon: 'filter_alt' },
  { value: 'treemap', labelKey: 'charts.types.treemap', icon: 'grid_view' },
  { value: 'gauge', labelKey: 'charts.types.gauge', icon: 'speed' },
  { value: 'sankey', labelKey: 'charts.types.sankey', icon: 'account_tree' },
  { value: 'table', labelKey: 'charts.types.table', icon: 'table_rows' },
  { value: 'big_number', labelKey: 'charts.types.bigNumber', icon: 'looks_one' },
];

export type { ChartStackMode, ChartLegendPlacement, ChartDisplayConfig as TablesChartDisplayConfig };

export { DEFAULT_CHART_DISPLAY_CONFIG };

export type CartesianConfigSection = 'layout' | 'series' | 'axes' | 'display' | 'margins';

export const CARTESIAN_CONFIG_SECTIONS: { id: CartesianConfigSection; labelKey: string }[] = [
  { id: 'layout', labelKey: 'charts.sections.layout' },
  { id: 'series', labelKey: 'charts.sections.series' },
  { id: 'axes', labelKey: 'charts.sections.axes' },
  { id: 'display', labelKey: 'charts.sections.display' },
  { id: 'margins', labelKey: 'charts.sections.margins' },
];

export type TableConfigSection = 'general' | 'conditional-formatting' | 'cell-display';

export const TABLE_CONFIG_SECTIONS: { id: TableConfigSection; labelKey: string }[] = [
  { id: 'general', labelKey: 'charts.sections.general' },
  { id: 'conditional-formatting', labelKey: 'charts.sections.conditionalFormatting' },
  { id: 'cell-display', labelKey: 'charts.sections.cellDisplay' },
];

export type PieConfigSection = 'layout' | 'display' | 'margins';

export const PIE_CONFIG_SECTIONS: { id: PieConfigSection; labelKey: string }[] = [
  { id: 'layout', labelKey: 'charts.sections.layout' },
  { id: 'display', labelKey: 'charts.sections.display' },
  { id: 'margins', labelKey: 'charts.sections.margins' },
];

export type FunnelConfigSection = 'layout' | 'display';

export const FUNNEL_CONFIG_SECTIONS: { id: FunnelConfigSection; labelKey: string }[] = [
  { id: 'layout', labelKey: 'charts.sections.layout' },
  { id: 'display', labelKey: 'charts.sections.display' },
];

export type TreemapConfigSection = 'layout' | 'display';

export const TREEMAP_CONFIG_SECTIONS: { id: TreemapConfigSection; labelKey: string }[] = [
  { id: 'layout', labelKey: 'charts.sections.layout' },
  { id: 'display', labelKey: 'charts.sections.display' },
];

export type GaugeConfigSection = 'layout' | 'display';

export const GAUGE_CONFIG_SECTIONS: { id: GaugeConfigSection; labelKey: string }[] = [
  { id: 'layout', labelKey: 'charts.sections.layout' },
  { id: 'display', labelKey: 'charts.sections.display' },
];

export type SankeyConfigSection = 'layout' | 'display';

export const SANKEY_CONFIG_SECTIONS: { id: SankeyConfigSection; labelKey: string }[] = [
  { id: 'layout', labelKey: 'charts.sections.layout' },
  { id: 'display', labelKey: 'charts.sections.display' },
];
