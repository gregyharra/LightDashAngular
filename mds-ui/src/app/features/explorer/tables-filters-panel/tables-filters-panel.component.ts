import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  DashboardDimensionFilter,
  DashboardFilterOperator,
  DashboardFilterUnitOfTime,
} from '../../../core/models/dashboard.model';
import {
  formatDashboardFilterSummary,
  formatFilterOperator,
} from '../../dashboards/dashboard-filters';
import {
  FILTER_UNIT_OF_TIME_OPTIONS,
  FilterableDimension,
  createExplorerFilter,
  defaultOperatorForDimensionType,
  getOperatorsForDimensionType,
  operatorNeedsTwoValues,
  operatorNeedsUnitOfTime,
  operatorNeedsValue,
} from './tables-filters.utils';

@Component({
  selector: 'app-tables-filters-panel',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './tables-filters-panel.component.html',
  styleUrl: './tables-filters-panel.component.scss',
})
export class TablesFiltersPanelComponent {
  readonly dimensions = input<FilterableDimension[]>([]);
  readonly filters = input<DashboardDimensionFilter[]>([]);

  readonly filtersChange = output<DashboardDimensionFilter[]>();

  protected readonly addingFilter = signal(false);
  protected readonly draftFieldId = signal<string | null>(null);
  protected readonly draftOperator = signal<DashboardFilterOperator>('equals');
  protected readonly draftValue = signal('');
  protected readonly draftValue2 = signal('');
  protected readonly draftUnitOfTime = signal<DashboardFilterUnitOfTime>('months');

  protected readonly unitOfTimeOptions = FILTER_UNIT_OF_TIME_OPTIONS;

  protected readonly draftDimension = computed(() => {
    const fieldId = this.draftFieldId();
    if (!fieldId) {
      return null;
    }
    return this.dimensions().find((dimension) => dimension.fieldId === fieldId) ?? null;
  });

  protected readonly draftOperators = computed(() => {
    const dimension = this.draftDimension();
    if (!dimension) {
      return ['equals'] as DashboardFilterOperator[];
    }
    return getOperatorsForDimensionType(dimension.type);
  });

  protected readonly showDraftValue = computed(() =>
    operatorNeedsValue(this.draftOperator()),
  );

  protected readonly showDraftUnitOfTime = computed(() =>
    operatorNeedsUnitOfTime(this.draftOperator()),
  );

  protected readonly showDraftSecondValue = computed(() =>
    operatorNeedsTwoValues(this.draftOperator()),
  );

  protected readonly canApplyDraft = computed(() => {
    const dimension = this.draftDimension();
    if (!dimension) {
      return false;
    }

    const operator = this.draftOperator();
    if (!operatorNeedsValue(operator)) {
      return true;
    }

    if (operatorNeedsTwoValues(operator)) {
      return this.draftValue().trim().length > 0 && this.draftValue2().trim().length > 0;
    }

    return this.draftValue().trim().length > 0;
  });

  protected formatFilterSummary(filter: DashboardDimensionFilter): string {
    return formatDashboardFilterSummary(filter);
  }

  protected formatOperator(operator: DashboardFilterOperator): string {
    return formatFilterOperator(operator);
  }

  protected startAddFilter(): void {
    const firstDimension = this.dimensions()[0];
    this.addingFilter.set(true);
    this.draftFieldId.set(firstDimension?.fieldId ?? null);
    this.draftOperator.set(
      firstDimension
        ? defaultOperatorForDimensionType(firstDimension.type)
        : 'equals',
    );
    this.draftValue.set('');
    this.draftValue2.set('');
    this.draftUnitOfTime.set('months');
  }

  protected cancelAddFilter(): void {
    this.addingFilter.set(false);
  }

  protected onDraftFieldChange(fieldId: string): void {
    const dimension = this.dimensions().find((item) => item.fieldId === fieldId);
    this.draftFieldId.set(fieldId);
    if (dimension) {
      this.draftOperator.set(defaultOperatorForDimensionType(dimension.type));
    }
    this.draftValue.set('');
    this.draftValue2.set('');
  }

  protected onDraftOperatorChange(operator: DashboardFilterOperator): void {
    this.draftOperator.set(operator);
    if (!operatorNeedsUnitOfTime(operator)) {
      this.draftUnitOfTime.set('months');
    }
  }

  protected applyDraftFilter(): void {
    const dimension = this.draftDimension();
    if (!dimension || !this.canApplyDraft()) {
      return;
    }

    const operator = this.draftOperator();
    const values = operatorNeedsValue(operator)
      ? operatorNeedsTwoValues(operator)
        ? [this.parseDraftValue(dimension.type, this.draftValue()), this.parseDraftValue(dimension.type, this.draftValue2())]
        : [this.parseDraftValue(dimension.type, this.draftValue())]
      : [];

    const filter = createExplorerFilter(
      dimension,
      operator,
      values,
      operatorNeedsUnitOfTime(operator)
        ? { unitOfTime: this.draftUnitOfTime() }
        : undefined,
    );

    this.filtersChange.emit([...this.filters(), filter]);
    this.addingFilter.set(false);
  }

  protected removeFilter(filterId: string): void {
    this.filtersChange.emit(this.filters().filter((filter) => filter.id !== filterId));
  }

  private parseDraftValue(type: string, raw: string): unknown {
    if (type === 'number' || type === 'count') {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : raw;
    }

    if (
      operatorNeedsUnitOfTime(this.draftOperator()) &&
      (type === 'date' || type === 'timestamp')
    ) {
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : raw;
    }

    return raw.trim();
  }
}
