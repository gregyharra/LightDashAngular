import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import {
  DateFilterValue,
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

  protected readonly draftText = signal('');
  protected readonly draftSelect = signal<string[]>([]);
  protected readonly draftDateFrom = signal<string | null>(null);
  protected readonly draftDateTo = signal<string | null>(null);
  protected readonly draftMin = signal<string>('');
  protected readonly draftMax = signal<string>('');

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
        this.draftMin.set(numberValue.min !== null ? String(numberValue.min) : '');
        this.draftMax.set(numberValue.max !== null ? String(numberValue.max) : '');
        break;
      }
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
      case 'number':
        this.valueChange.emit({
          min: this.parseOptionalNumber(this.draftMin()),
          max: this.parseOptionalNumber(this.draftMax()),
        });
        break;
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
        this.draftMin.set('');
        this.draftMax.set('');
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

  private parseOptionalNumber(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) {
      return null;
    }

    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
}
