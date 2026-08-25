import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import {
  AdditionalMetric,
  FieldId,
  MetricAggregation,
} from '../../../core/models/explore.model';
import {
  buildAdditionalMetric,
  isValidCustomMetricName,
} from './custom-metric.utils';

export type CustomMetricDimensionOption = {
  fieldId: FieldId;
  label: string;
  tableLabel: string;
  tableName: string;
};

export type CustomMetricDialogData = {
  dimensions: CustomMetricDimensionOption[];
};

export type CustomMetricDialogResult = AdditionalMetric | undefined;

type AggregationOption = {
  value: MetricAggregation;
  labelKey: string;
};

const AGGREGATIONS: AggregationOption[] = [
  { value: 'sum', labelKey: 'explorer.customMetric.aggregations.sum' },
  { value: 'count', labelKey: 'explorer.customMetric.aggregations.count' },
  { value: 'count_distinct', labelKey: 'explorer.customMetric.aggregations.countDistinct' },
  { value: 'avg', labelKey: 'explorer.customMetric.aggregations.average' },
  { value: 'min', labelKey: 'explorer.customMetric.aggregations.minimum' },
  { value: 'max', labelKey: 'explorer.customMetric.aggregations.maximum' },
];

@Component({
  selector: 'app-custom-metric-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    TranslatePipe,
  ],
  templateUrl: './custom-metric-dialog.component.html',
  styleUrl: './custom-metric-dialog.component.scss',
})
export class CustomMetricDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<CustomMetricDialogComponent, CustomMetricDialogResult>,
  );

  readonly data = inject<CustomMetricDialogData>(MAT_DIALOG_DATA);
  protected readonly aggregations = AGGREGATIONS;

  protected name = '';
  protected label = '';
  protected aggregation: MetricAggregation = 'sum';
  protected dimensionFieldId = this.data.dimensions[0]?.fieldId ?? '';

  protected isNameValid(): boolean {
    return isValidCustomMetricName(this.name);
  }

  protected canSave(): boolean {
    return (
      this.isNameValid() &&
      !!this.label.trim() &&
      !!this.dimensionFieldId
    );
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }

    const dimension = this.data.dimensions.find(
      (option) => option.fieldId === this.dimensionFieldId,
    );
    if (!dimension) {
      return;
    }

    this.dialogRef.close(
      buildAdditionalMetric({
        name: this.name,
        label: this.label,
        tableName: dimension.tableName,
        aggregation: this.aggregation,
        dimensionFieldId: this.dimensionFieldId,
      }),
    );
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
