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
  { value: 'pie', label: 'Pie chart', icon: 'pie_chart' },
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
