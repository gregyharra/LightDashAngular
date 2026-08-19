import { Component, computed, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  LinkDialogMode,
  LinkDialogSavePayload,
  ModelJoinView,
  ModelLinkOption,
} from '../../../core/models/model-join.model';

const JOIN_TYPE_OPTIONS = [
  { value: 'left', label: 'Left join' },
  { value: 'inner', label: 'Inner join' },
  { value: 'right', label: 'Right join' },
  { value: 'full', label: 'Full join' },
];

const RELATIONSHIP_OPTIONS = [
  { value: 'many-to-one', label: 'Many to one' },
  { value: 'one-to-many', label: 'One to many' },
  { value: 'one-to-one', label: 'One to one' },
];

@Component({
  selector: 'app-link-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './link-dialog.component.html',
  styleUrl: './link-dialog.component.scss',
})
export class LinkDialogComponent {
  readonly mode = input.required<LinkDialogMode>();
  readonly models = input.required<ModelLinkOption[]>();
  readonly initialLink = input<ModelJoinView | null>(null);
  readonly lockedSourceModelId = input<string | null>(null);

  readonly saved = output<LinkDialogSavePayload>();
  readonly cancelled = output<void>();

  protected readonly joinTypeOptions = JOIN_TYPE_OPTIONS;
  protected readonly relationshipOptions = RELATIONSHIP_OPTIONS;
  protected readonly error = signal<string | null>(null);

  protected readonly sourceModelSearch = signal('');
  protected readonly targetModelSearch = signal('');
  protected readonly sourceColumnFilter = signal('');
  protected readonly targetColumnFilter = signal('');

  protected readonly sourceModelId = signal('');
  protected readonly targetModelId = signal('');
  protected readonly sourceColumn = signal('');
  protected readonly targetColumn = signal('');

  protected joinType = 'left';
  protected relationship = 'many-to-one';
  protected label = '';

  protected readonly isEdit = computed(() => !!this.initialLink()?.uuid);

  protected readonly filteredSourceModels = computed(() =>
    this.filterModels(this.models(), this.sourceModelSearch()),
  );

  protected readonly filteredTargetModels = computed(() =>
    this.filterModels(this.models(), this.targetModelSearch()),
  );

  protected readonly selectedSourceModel = computed(
    () => this.models().find((model) => model.id === this.sourceModelId()) ?? null,
  );

  protected readonly selectedTargetModel = computed(
    () => this.models().find((model) => model.id === this.targetModelId()) ?? null,
  );

  protected readonly filteredSourceColumns = computed(() =>
    this.filterColumns(this.selectedSourceModel()?.columns ?? [], this.sourceColumnFilter()),
  );

  protected readonly filteredTargetColumns = computed(() =>
    this.filterColumns(this.selectedTargetModel()?.columns ?? [], this.targetColumnFilter()),
  );

  protected readonly sqlPreview = computed(() => {
    const source = this.selectedSourceModel();
    const target = this.selectedTargetModel();
    const sourceCol = this.sourceColumn();
    const targetCol = this.targetColumn();
    if (!source || !target || !sourceCol || !targetCol) {
      return '';
    }
    return `${source.name}.${sourceCol} = ${target.name}.${targetCol}`;
  });

  constructor() {
    effect(() => {
      const link = this.initialLink();
      const locked = this.lockedSourceModelId();
      if (link) {
        this.sourceModelId.set(link.sourceModelId);
        this.targetModelId.set(link.targetModelId);
        this.sourceModelSearch.set(link.sourceModelName);
        this.targetModelSearch.set(link.targetModelName);
        this.sourceColumn.set(link.sourceColumn);
        this.targetColumn.set(link.targetColumn);
        this.joinType = link.joinType;
        this.relationship = link.relationship ?? 'many-to-one';
        this.label = link.label ?? '';
      } else if (locked) {
        this.sourceModelId.set(locked);
        const model = this.models().find((item) => item.id === locked);
        this.sourceModelSearch.set(model?.name ?? '');
      }
    });
  }

  protected onSourceModelOptionSelected(model: ModelLinkOption): void {
    this.sourceModelSearch.set(model.name);
    this.onSourceModelChange(model.id);
  }

  protected onTargetModelOptionSelected(model: ModelLinkOption): void {
    this.targetModelSearch.set(model.name);
    this.onTargetModelChange(model.id);
  }

  protected onSourceModelSearchChange(value: string): void {
    this.sourceModelSearch.set(value);
    const selected = this.selectedSourceModel();
    if (selected && selected.name !== value.trim()) {
      this.sourceModelId.set('');
      this.sourceColumn.set('');
    }
  }

  protected onTargetModelSearchChange(value: string): void {
    this.targetModelSearch.set(value);
    const selected = this.selectedTargetModel();
    if (selected && selected.name !== value.trim()) {
      this.targetModelId.set('');
      this.targetColumn.set('');
    }
  }

  protected onSourceColumnFilterChange(value: string): void {
    this.sourceColumnFilter.set(value);
  }

  protected onTargetColumnFilterChange(value: string): void {
    this.targetColumnFilter.set(value);
  }

  protected onSourceModelChange(modelId: string): void {
    this.sourceModelId.set(modelId);
    this.sourceColumn.set('');
    this.error.set(null);
  }

  protected onTargetModelChange(modelId: string): void {
    this.targetModelId.set(modelId);
    this.targetColumn.set('');
    this.error.set(null);
  }

  protected selectSourceColumn(columnName: string): void {
    this.sourceColumn.set(columnName);
    this.error.set(null);
  }

  protected selectTargetColumn(columnName: string): void {
    this.targetColumn.set(columnName);
    this.error.set(null);
  }

  protected isSourceColumnSelected(columnName: string): boolean {
    return this.sourceColumn() === columnName;
  }

  protected isTargetColumnSelected(columnName: string): boolean {
    return this.targetColumn() === columnName;
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.cancel();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.cancel();
    }
  }

  protected save(): void {
    if (!this.sourceModelId() || !this.targetModelId()) {
      this.error.set('Select source and target models.');
      return;
    }
    if (!this.sourceColumn() || !this.targetColumn()) {
      this.error.set('Select a column on each side.');
      return;
    }
    if (this.sourceModelId() === this.targetModelId()) {
      this.error.set('Source and target model must differ.');
      return;
    }

    const payload: LinkDialogSavePayload = {
      sourceModelId: this.sourceModelId(),
      sourceColumn: this.sourceColumn(),
      targetModelId: this.targetModelId(),
      targetColumn: this.targetColumn(),
      joinType: this.joinType,
      relationship: this.relationship,
      label: this.label.trim() || null,
      ...(this.initialLink()?.uuid ? { uuid: this.initialLink()!.uuid } : {}),
    };
    this.saved.emit(payload);
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  private filterModels(models: ModelLinkOption[], query: string): ModelLinkOption[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return models;
    }
    return models.filter((model) => model.name.toLowerCase().includes(normalized));
  }

  private filterColumns(
    columns: { name: string; type: string }[],
    query: string,
  ): { name: string; type: string }[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return columns;
    }
    return columns.filter(
      (column) =>
        column.name.toLowerCase().includes(normalized) ||
        column.type.toLowerCase().includes(normalized),
    );
  }
}
