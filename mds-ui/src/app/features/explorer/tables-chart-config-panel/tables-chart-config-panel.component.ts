import { TitleCasePipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartKind } from '../../../core/models/chart.model';
import { FieldId } from '../../../core/models/explore.model';
import {
  CARTESIAN_CONFIG_SECTIONS,
  ChartLegendPlacement,
  ChartStackMode,
  DEFAULT_CHART_DISPLAY_CONFIG,
  TABLES_CHART_TYPE_OPTIONS,
  TABLE_CONFIG_SECTIONS,
  TablesChartDisplayConfig,
} from './tables-chart-config.constants';

@Component({
  selector: 'app-tables-chart-config-panel',
  imports: [
    TitleCasePipe,
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './tables-chart-config-panel.component.html',
  styleUrl: './tables-chart-config-panel.component.scss',
})
export class TablesChartConfigPanelComponent {
  protected readonly chartTypeOptions = TABLES_CHART_TYPE_OPTIONS;
  protected readonly cartesianSections = CARTESIAN_CONFIG_SECTIONS;
  protected readonly tableSections = TABLE_CONFIG_SECTIONS;

  readonly chartKind = input.required<ChartKind>();
  readonly chartXField = input<FieldId | null>(null);
  readonly chartYFields = input<FieldId[]>([]);
  readonly selectedDimensions = input<FieldId[]>([]);
  readonly selectedMetrics = input<FieldId[]>([]);
  readonly displayConfig = input<TablesChartDisplayConfig>(DEFAULT_CHART_DISPLAY_CONFIG);
  readonly hasQueryResults = input(false);
  readonly getFieldLabel = input.required<(fieldId: FieldId) => string>();

  readonly chartKindChange = output<ChartKind>();
  readonly chartXFieldChange = output<FieldId>();
  readonly chartYFieldsChange = output<FieldId[]>();
  readonly displayConfigChange = output<TablesChartDisplayConfig>();

  protected readonly selectedChartType = computed(() => {
    const kind = this.chartKind();
    return (
      this.chartTypeOptions.find((option) => option.value === kind) ??
      this.chartTypeOptions[0]
    );
  });

  protected readonly isCartesianChart = computed(() => {
    const kind = this.chartKind();
    return kind === 'vertical_bar' || kind === 'horizontal_bar' || kind === 'line';
  });

  protected readonly isTableChart = computed(() => this.chartKind() === 'table');

  protected readonly isBigNumberChart = computed(() => this.chartKind() === 'big_number');

  protected readonly bigNumberMetric = computed(() => this.chartYFields()[0] ?? null);

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
