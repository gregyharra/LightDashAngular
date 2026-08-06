import {
  ChartDisplayConfig,
  ChartKind,
  ChartLegendPlacement,
  ChartStackMode,
  DEFAULT_CHART_DISPLAY_CONFIG,
} from '../../../core/models/chart.model';

export type TablesChartTypeOption = {
  value: ChartKind;
  label: string;
  icon: string;
};

export const TABLES_CHART_TYPE_OPTIONS: TablesChartTypeOption[] = [
  { value: 'vertical_bar', label: 'Bar chart', icon: 'bar_chart' },
  { value: 'horizontal_bar', label: 'Horizontal bar chart', icon: 'align_horizontal_left' },
  { value: 'line', label: 'Line chart', icon: 'show_chart' },
  { value: 'area', label: 'Area chart', icon: 'area_chart' },
  { value: 'scatter', label: 'Scatter chart', icon: 'scatter_plot' },
  { value: 'pie', label: 'Pie chart', icon: 'pie_chart' },
  { value: 'funnel', label: 'Funnel chart', icon: 'filter_alt' },
  { value: 'treemap', label: 'Treemap', icon: 'grid_view' },
  { value: 'gauge', label: 'Gauge', icon: 'speed' },
  { value: 'sankey', label: 'Sankey', icon: 'account_tree' },
  { value: 'table', label: 'Table', icon: 'table_rows' },
  { value: 'big_number', label: 'Big value', icon: 'looks_one' },
];

export type { ChartStackMode, ChartLegendPlacement, ChartDisplayConfig as TablesChartDisplayConfig };

export { DEFAULT_CHART_DISPLAY_CONFIG };

export type CartesianConfigSection = 'layout' | 'series' | 'axes' | 'display' | 'margins';

export const CARTESIAN_CONFIG_SECTIONS: { id: CartesianConfigSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'series', label: 'Series' },
  { id: 'axes', label: 'Axes' },
  { id: 'display', label: 'Display' },
  { id: 'margins', label: 'Margins' },
];

export type TableConfigSection = 'general' | 'conditional-formatting' | 'cell-display';

export const TABLE_CONFIG_SECTIONS: { id: TableConfigSection; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'conditional-formatting', label: 'Conditional formatting' },
  { id: 'cell-display', label: 'Cell display' },
];

export type PieConfigSection = 'layout' | 'display' | 'margins';

export const PIE_CONFIG_SECTIONS: { id: PieConfigSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'display', label: 'Display' },
  { id: 'margins', label: 'Margins' },
];

export type FunnelConfigSection = 'layout' | 'display';

export const FUNNEL_CONFIG_SECTIONS: { id: FunnelConfigSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'display', label: 'Display' },
];

export type TreemapConfigSection = 'layout' | 'display';

export const TREEMAP_CONFIG_SECTIONS: { id: TreemapConfigSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'display', label: 'Display' },
];

export type GaugeConfigSection = 'layout' | 'display';

export const GAUGE_CONFIG_SECTIONS: { id: GaugeConfigSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'display', label: 'Display' },
];

export type SankeyConfigSection = 'layout' | 'display';

export const SANKEY_CONFIG_SECTIONS: { id: SankeyConfigSection; label: string }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'display', label: 'Display' },
];
