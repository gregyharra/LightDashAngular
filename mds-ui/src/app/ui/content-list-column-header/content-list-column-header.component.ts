import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import {
  DateFilterValue,
  NUMBER_FILTER_OPERATOR_OPTIONS,
  NumberFilterOperator,
  NumberFilterValue,
  SelectFilterValue,
  SelectOption,
  TextFilterValue,
  emptyDateFilter,
  emptyNumberFilter,
  emptySelectFilter,
  emptyTextFilter,
  isDateFilterActive,
  isNumberFilterActive,
  isSelectFilterActive,
  isTextFilterActive,
  numberFilterNeedsTwoValues,
} from '../content-list-filter.utils';

export type ColumnFilterType = 'text' | 'select' | 'date' | 'number';

export type ColumnFilterValue =
  | TextFilterValue
  | SelectFilterValue
  | DateFilterValue
  | NumberFilterValue;

@Component({
  selector: 'app-content-list-column-header',
  imports: [
    FormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './content-list-column-header.component.html',
  styleUrl: './content-list-column-header.component.scss',
})
export class ContentListColumnHeaderComponent {
  readonly label = input.required<string>();
  readonly filterType = input.required<ColumnFilterType>();
  readonly options = input<SelectOption[]>([]);
  readonly textPlaceholder = input('Contains…');
  readonly value = input.required<ColumnFilterValue>();

  readonly valueChange = output<ColumnFilterValue>();

  protected readonly numberOperatorOptions = NUMBER_FILTER_OPERATOR_OPTIONS;

  protected readonly draftText = signal('');
  protected readonly draftSelect = signal<string[]>([]);
  protected readonly draftDateFrom = signal<string | null>(null);
  protected readonly draftDateTo = signal<string | null>(null);
  protected readonly draftNumberOperator = signal<NumberFilterOperator>('equals');
  protected readonly draftNumberValue = signal('');
  protected readonly draftNumberValueTo = signal('');

  protected readonly numberNeedsTwoValues = computed(() =>
    numberFilterNeedsTwoValues(this.draftNumberOperator()),
  );

  protected readonly isActive = computed(() => {
    const filterType = this.filterType();
    const value = this.value();

    switch (filterType) {
      case 'text':
        return isTextFilterActive(value as TextFilterValue);
      case 'select':
        return isSelectFilterActive(value as SelectFilterValue);
      case 'date':
        return isDateFilterActive(value as DateFilterValue);
      case 'number':
        return isNumberFilterActive(value as NumberFilterValue);
    }
  });

  protected syncDraftFromValue(): void {
    const filterType = this.filterType();
    const value = this.value();

    switch (filterType) {
      case 'text':
        this.draftText.set((value as TextFilterValue).query);
        break;
      case 'select':
        this.draftSelect.set([...(value as SelectFilterValue).values]);
        break;
      case 'date': {
        const dateValue = value as DateFilterValue;
        this.draftDateFrom.set(dateValue.from);
        this.draftDateTo.set(dateValue.to);
        break;
      }
      case 'number': {
        const numberValue = value as NumberFilterValue;
        this.draftNumberOperator.set(numberValue.operator);
        this.draftNumberValue.set(
          numberValue.value !== null ? String(numberValue.value) : '',
        );
        this.draftNumberValueTo.set(
          numberValue.valueTo !== null ? String(numberValue.valueTo) : '',
        );
        break;
      }
    }
  }

  protected onNumberOperatorChange(operator: NumberFilterOperator): void {
    this.draftNumberOperator.set(operator);
    if (!numberFilterNeedsTwoValues(operator)) {
      this.draftNumberValueTo.set('');
    }
  }

  protected applyFilter(): void {
    const filterType = this.filterType();

    switch (filterType) {
      case 'text':
        this.valueChange.emit({ query: this.draftText() });
        break;
      case 'select':
        this.valueChange.emit({ values: [...this.draftSelect()] });
        break;
      case 'date':
        this.valueChange.emit({
          from: this.draftDateFrom() || null,
          to: this.draftDateTo() || null,
        });
        break;
      case 'number': {
        const operator = this.draftNumberOperator();
        this.valueChange.emit({
          operator,
          value: this.parseOptionalNumber(this.draftNumberValue()),
          valueTo: numberFilterNeedsTwoValues(operator)
            ? this.parseOptionalNumber(this.draftNumberValueTo())
            : null,
        });
        break;
      }
    }
  }

  protected clearFilter(): void {
    const filterType = this.filterType();

    switch (filterType) {
      case 'text':
        this.draftText.set('');
        this.valueChange.emit(emptyTextFilter());
        break;
      case 'select':
        this.draftSelect.set([]);
        this.valueChange.emit(emptySelectFilter());
        break;
      case 'date':
        this.draftDateFrom.set(null);
        this.draftDateTo.set(null);
        this.valueChange.emit(emptyDateFilter());
        break;
      case 'number':
        this.draftNumberOperator.set('equals');
        this.draftNumberValue.set('');
        this.draftNumberValueTo.set('');
        this.valueChange.emit(emptyNumberFilter());
        break;
    }
  }

  protected toggleSelectOption(optionValue: string, checked: boolean): void {
    const current = this.draftSelect();
    if (checked) {
      this.draftSelect.set([...current, optionValue]);
      return;
    }

    this.draftSelect.set(current.filter((value) => value !== optionValue));
  }

  protected isOptionSelected(optionValue: string): boolean {
    return this.draftSelect().includes(optionValue);
  }

  protected setDraftNumberValue(raw: string | number | null): void {
    this.draftNumberValue.set(this.normalizeNumberDraft(raw));
  }

  protected setDraftNumberValueTo(raw: string | number | null): void {
    this.draftNumberValueTo.set(this.normalizeNumberDraft(raw));
  }

  private normalizeNumberDraft(raw: string | number | null): string {
    if (raw === null || raw === undefined || raw === '') {
      return '';
    }
    return String(raw);
  }

  private parseOptionalNumber(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
