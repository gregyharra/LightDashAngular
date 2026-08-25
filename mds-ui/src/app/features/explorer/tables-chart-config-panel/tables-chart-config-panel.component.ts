import { TitleCasePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { ChartKind } from '../../../core/models/chart.model';
import { FieldId } from '../../../core/models/explore.model';
import {
  clampQueryLimit,
  resolveMaxQueryLimit,
} from '../query-limit.utils';
import {
  CARTESIAN_CONFIG_SECTIONS,
  ChartLegendPlacement,
  ChartStackMode,
  DEFAULT_CHART_DISPLAY_CONFIG,
  FUNNEL_CONFIG_SECTIONS,
  GAUGE_CONFIG_SECTIONS,
  PIE_CONFIG_SECTIONS,
  SANKEY_CONFIG_SECTIONS,
  TABLES_CHART_TYPE_OPTIONS,
  TABLE_CONFIG_SECTIONS,
  TREEMAP_CONFIG_SECTIONS,
  TablesChartDisplayConfig,
} from './tables-chart-config.constants';

@Component({
  selector: 'app-tables-chart-config-panel',
  imports: [
    TitleCasePipe,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './tables-chart-config-panel.component.html',
  styleUrl: './tables-chart-config-panel.component.scss',
})
export class TablesChartConfigPanelComponent {
  protected readonly chartTypeOptions = TABLES_CHART_TYPE_OPTIONS;
  protected readonly cartesianSections = CARTESIAN_CONFIG_SECTIONS;
  protected readonly pieSections = PIE_CONFIG_SECTIONS;
  protected readonly tableSections = TABLE_CONFIG_SECTIONS;
  protected readonly funnelSections = FUNNEL_CONFIG_SECTIONS;
  protected readonly treemapSections = TREEMAP_CONFIG_SECTIONS;
  protected readonly gaugeSections = GAUGE_CONFIG_SECTIONS;
  protected readonly sankeySections = SANKEY_CONFIG_SECTIONS;


  readonly chartKind = input.required<ChartKind>();
  readonly chartXField = input<FieldId | null>(null);
  readonly chartYFields = input<FieldId[]>([]);
  readonly selectedDimensions = input<FieldId[]>([]);
  readonly selectedMetrics = input<FieldId[]>([]);
  readonly displayConfig = input<TablesChartDisplayConfig>(DEFAULT_CHART_DISPLAY_CONFIG);
  readonly maxRowLimit = input<number | null | undefined>(undefined);
  readonly hasQueryResults = input(false);
  readonly getFieldLabel = input.required<(fieldId: FieldId) => string>();

  readonly chartKindChange = output<ChartKind>();
  readonly chartXFieldChange = output<FieldId>();
  readonly chartYFieldsChange = output<FieldId[]>();
  readonly displayConfigChange = output<TablesChartDisplayConfig>();

  protected readonly resolvedMaxRowLimit = computed(() =>
    resolveMaxQueryLimit(this.maxRowLimit()),
  );

  protected readonly selectedChartType = computed(() => {
    const kind = this.chartKind();
    return (
      this.chartTypeOptions.find((option) => option.value === kind) ??
      this.chartTypeOptions[0]
    );
  });

  protected readonly isCartesianChart = computed(() => {
    const kind = this.chartKind();
    return (
      kind === 'vertical_bar' ||
      kind === 'horizontal_bar' ||
      kind === 'line' ||
      kind === 'area' ||
      kind === 'scatter'
    );
  });


  protected readonly isTableChart = computed(() => this.chartKind() === 'table');

  protected readonly isPieChart = computed(() => this.chartKind() === 'pie');

  protected readonly isBigNumberChart = computed(() => this.chartKind() === 'big_number');

  protected readonly isFunnelChart = computed(() => this.chartKind() === 'funnel');

  protected readonly isTreemapChart = computed(() => this.chartKind() === 'treemap');

  protected readonly isGaugeChart = computed(() => this.chartKind() === 'gauge');

  protected readonly isSankeyChart = computed(() => this.chartKind() === 'sankey');

  protected readonly bigNumberMetric = computed(() => this.chartYFields()[0] ?? null);

  protected readonly pieMetric = computed(() => this.chartYFields()[0] ?? null);

  protected readonly funnelMetric = computed(() => this.chartXField());

  protected readonly funnelLabelField = computed(() => this.chartYFields()[0] ?? null);

  protected readonly treemapMetric = computed(() => this.chartYFields()[0] ?? null);

  protected readonly gaugeMetric = computed(() => this.chartYFields()[0] ?? null);

  readonly funnelDataInput = input<'column' | 'row'>('column');

  readonly funnelDataInputChange = output<'column' | 'row'>();

  readonly treemapDimensionFieldIds = input<FieldId[]>([]);

  readonly treemapDimensionFieldIdsChange = output<FieldId[]>();

  readonly gaugeMin = input<number | undefined>(undefined);

  readonly gaugeMax = input<number | undefined>(undefined);

  readonly showGaugeLabel = input(true);

  readonly gaugeMinChange = output<number | undefined>();

  readonly gaugeMaxChange = output<number | undefined>();

  readonly showGaugeLabelChange = output<boolean>();

  readonly sankeySourceFieldId = input<FieldId | null>(null);

  readonly sankeyTargetFieldId = input<FieldId | null>(null);

  readonly sankeyWeightFieldId = input<FieldId | null>(null);

  readonly showNodeLabels = input(true);

  readonly sankeySourceFieldIdChange = output<FieldId>();

  readonly sankeyTargetFieldIdChange = output<FieldId>();

  readonly sankeyWeightFieldIdChange = output<FieldId>();

  readonly showNodeLabelsChange = output<boolean>();

  protected readonly availableTreemapDimensions = computed(() => {
    const selected = new Set(this.treemapDimensionFieldIds());
    return this.selectedDimensions().filter((fieldId) => !selected.has(fieldId));
  });

  protected readonly availableYFields = computed(() => {
    const selected = new Set(this.chartYFields());
    return this.selectedMetrics().filter((fieldId) => !selected.has(fieldId));
  });

  protected readonly xAxisHeading = computed(() =>
    this.displayConfig().flipAxes ? 'Y-axis' : 'X-axis',
  );

  protected readonly yAxisHeading = computed(() =>
    this.displayConfig().flipAxes ? 'X-axis' : 'Y-axis',
  );

  protected setChartKind(kind: ChartKind): void {
    this.chartKindChange.emit(kind);
  }



  protected setChartXField(fieldId: FieldId): void {
    this.chartXFieldChange.emit(fieldId);
  }

  protected setChartYField(index: number, fieldId: FieldId): void {
    const next = [...this.chartYFields()];
    next[index] = fieldId;
    this.chartYFieldsChange.emit(next);
  }

  protected setBigNumberMetric(fieldId: FieldId): void {
    this.chartYFieldsChange.emit([fieldId]);
  }

  protected setPieMetric(fieldId: FieldId): void {
    this.chartYFieldsChange.emit([fieldId]);
  }

  protected setFunnelMetric(fieldId: FieldId): void {
    this.chartXFieldChange.emit(fieldId);
  }

  protected setFunnelLabelField(fieldId: FieldId | null): void {
    this.chartYFieldsChange.emit(fieldId ? [fieldId] : []);
  }

  protected setFunnelDataInput(dataInput: 'column' | 'row'): void {
    this.funnelDataInputChange.emit(dataInput);
  }

  protected setTreemapMetric(fieldId: FieldId): void {
    this.chartYFieldsChange.emit([fieldId]);
  }

  protected setGaugeMetric(fieldId: FieldId): void {
    this.chartYFieldsChange.emit([fieldId]);
  }

  protected setGaugeMin(value: number | string | null): void {
    const parsed =
      value === '' || value === null ? undefined : Number(value);
    this.gaugeMinChange.emit(
      parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
    );
  }

  protected setGaugeMax(value: number | string | null): void {
    const parsed =
      value === '' || value === null ? undefined : Number(value);
    this.gaugeMaxChange.emit(
      parsed === undefined || Number.isNaN(parsed) ? undefined : parsed,
    );
  }

  protected setShowGaugeLabel(show: boolean): void {
    this.showGaugeLabelChange.emit(show);
  }

  protected setSankeySourceFieldId(fieldId: FieldId): void {
    this.sankeySourceFieldIdChange.emit(fieldId);
  }

  protected setSankeyTargetFieldId(fieldId: FieldId): void {
    this.sankeyTargetFieldIdChange.emit(fieldId);
  }

  protected setSankeyWeightFieldId(fieldId: FieldId): void {
    this.sankeyWeightFieldIdChange.emit(fieldId);
  }

  protected setShowNodeLabels(show: boolean): void {
    this.showNodeLabelsChange.emit(show);
  }

  protected setTreemapDimensionField(index: number, fieldId: FieldId): void {
    const next = [...this.treemapDimensionFieldIds()];
    next[index] = fieldId;
    this.treemapDimensionFieldIdsChange.emit(next);
  }

  protected addTreemapDimension(): void {
    const available = this.availableTreemapDimensions();
    if (available.length === 0) {
      return;
    }
    this.treemapDimensionFieldIdsChange.emit([
      ...this.treemapDimensionFieldIds(),
      available[0],
    ]);
  }

  protected removeTreemapDimension(index: number): void {
    const next = this.treemapDimensionFieldIds().filter(
      (_, fieldIndex) => fieldIndex !== index,
    );
    this.treemapDimensionFieldIdsChange.emit(next);
  }

  protected moveTreemapDimension(index: number, direction: -1 | 1): void {
    const next = [...this.treemapDimensionFieldIds()];
    const target = index + direction;
    if (target < 0 || target >= next.length) {
      return;
    }
    [next[index], next[target]] = [next[target], next[index]];
    this.treemapDimensionFieldIdsChange.emit(next);
  }

  protected treemapDimensionOptions(currentFieldId: FieldId): FieldId[] {
    const dimensions = this.selectedDimensions();
    return dimensions.includes(currentFieldId)
      ? dimensions
      : [currentFieldId, ...dimensions];
  }

  protected addYField(): void {
    const available = this.availableYFields();
    if (available.length === 0) {
      return;
    }
    this.chartYFieldsChange.emit([...this.chartYFields(), available[0]]);
  }

  protected removeYField(index: number): void {
    const next = this.chartYFields().filter((_, fieldIndex) => fieldIndex !== index);
    this.chartYFieldsChange.emit(next.length > 0 ? next : []);
  }

  protected toggleFlipAxes(): void {
    this.patchDisplayConfig({ flipAxes: !this.displayConfig().flipAxes });
  }

  protected setStackMode(mode: ChartStackMode): void {
    this.patchDisplayConfig({ stackMode: mode });
  }

  protected patchDisplayConfig(patch: Partial<TablesChartDisplayConfig>): void {
    this.displayConfigChange.emit({
      ...this.displayConfig(),
      ...patch,
    });
  }

  protected setRowLimit(value: number | string | null): void {
    this.patchDisplayConfig({
      rowLimit: clampQueryLimit(value, this.maxRowLimit()),
    });
  }

  protected onRowLimitKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      const target = event.target as HTMLInputElement;
      this.setRowLimit(target.value);
    }
  }

  protected patchMargins(
    side: 'top' | 'right' | 'bottom' | 'left',
    value: number,
  ): void {
    this.patchDisplayConfig({
      margins: {
        ...this.displayConfig().margins,
        [side]: value,
      },
    });
  }

  protected setLegendPlacement(placement: ChartLegendPlacement): void {
    this.patchDisplayConfig({ legendPlacement: placement });
  }

  protected readonly marginSides: Array<'top' | 'right' | 'bottom' | 'left'> = [
    'top',
    'right',
    'bottom',
    'left',
  ];

  protected marginValue(side: 'top' | 'right' | 'bottom' | 'left'): number {
    return this.displayConfig().margins[side];
  }

  protected yFieldOptions(currentFieldId: FieldId): FieldId[] {
    const metrics = this.selectedMetrics();
    return metrics.includes(currentFieldId)
      ? metrics
      : [currentFieldId, ...metrics];
  }
}
