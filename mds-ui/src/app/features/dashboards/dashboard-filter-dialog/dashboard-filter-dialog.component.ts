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
import {
  DashboardDimensionFilter,
  DashboardFilterOperator,
  DashboardFilterUnitOfTime,
} from '../../../core/models/dashboard.model';
import { formatFilterOperator } from '../dashboard-filters';
import {
  FILTER_UNIT_OF_TIME_OPTIONS,
  FilterableDimension,
  createExplorerFilter,
  defaultOperatorForDimensionType,
  getOperatorsForDimensionType,
  operatorNeedsTwoValues,
  operatorNeedsUnitOfTime,
  operatorNeedsValue,
} from '../../explorer/tables-filters-panel/tables-filters.utils';

export type DashboardFilterDialogData = {
  dimensions: FilterableDimension[];
  filter?: DashboardDimensionFilter;
};

export type DashboardFilterDialogResult =
  | {
      action: 'save';
      filter: DashboardDimensionFilter;
    }
  | undefined;

@Component({
  selector: 'app-dashboard-filter-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './dashboard-filter-dialog.component.html',
  styleUrl: './dashboard-filter-dialog.component.scss',
})
export class DashboardFilterDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<DashboardFilterDialogComponent, DashboardFilterDialogResult>,
  );
  readonly data = inject<DashboardFilterDialogData>(MAT_DIALOG_DATA);

  protected readonly dimensions = this.data.dimensions;
  protected readonly isEditing = !!this.data.filter;

  protected fieldId = this.data.filter?.target.fieldId ?? '';
  protected operator: DashboardFilterOperator =
    this.data.filter?.operator ?? 'equals';
  protected value = this.formatInitialValue(this.data.filter?.values[0]);
  protected value2 = this.formatInitialValue(this.data.filter?.values[1]);
  protected unitOfTime: DashboardFilterUnitOfTime =
    this.data.filter?.settings?.unitOfTime ?? 'months';
  protected readonly unitOfTimeOptions = FILTER_UNIT_OF_TIME_OPTIONS;

  protected get selectedDimension(): FilterableDimension | null {
    return (
      this.dimensions.find((dimension) => dimension.fieldId === this.fieldId) ??
      null
    );
  }

  protected get operators(): DashboardFilterOperator[] {
    const dimension = this.selectedDimension;
    if (!dimension) {
      return ['equals'];
    }
    return getOperatorsForDimensionType(dimension.type);
  }

  protected get showValue(): boolean {
    return operatorNeedsValue(this.operator);
  }

  protected get showUnitOfTime(): boolean {
    return operatorNeedsUnitOfTime(this.operator);
  }

  protected get showSecondValue(): boolean {
    return operatorNeedsTwoValues(this.operator);
  }

  protected get dialogTitle(): string {
    return this.isEditing ? 'Edit dashboard filter' : 'Add dashboard filter';
  }

  protected formatOperator(operator: DashboardFilterOperator): string {
    return formatFilterOperator(operator);
  }

  protected onFieldChange(fieldId: string): void {
    this.fieldId = fieldId;
    const dimension = this.dimensions.find((item) => item.fieldId === fieldId);
    if (!dimension) {
      return;
    }

    this.operator = defaultOperatorForDimensionType(dimension.type);
    this.value = '';
    this.value2 = '';
  }

  protected onOperatorChange(operator: DashboardFilterOperator): void {
    this.operator = operator;
    if (!operatorNeedsValue(operator)) {
      this.value = '';
      this.value2 = '';
    }
  }

  protected save(): void {
    const dimension = this.selectedDimension;
    if (!dimension) {
      return;
    }

    const values: unknown[] = [];
    if (operatorNeedsValue(this.operator)) {
      if (this.showSecondValue) {
        values.push(this.value, this.value2);
      } else {
        values.push(this.value);
      }
    }

    const settings = operatorNeedsUnitOfTime(this.operator)
      ? { unitOfTime: this.unitOfTime, completed: true }
      : this.data.filter?.settings;

    const filter = createExplorerFilter(
      dimension,
      this.operator,
      values,
      settings,
    );

    if (this.data.filter) {
      filter.id = this.data.filter.id;
    }

    this.dialogRef.close({ action: 'save', filter });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }

  private formatInitialValue(value: unknown): string {
    return value === undefined || value === null ? '' : String(value);
  }
}
