import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CustomAttributeType } from '../../../../core/models/dictionary.model';

export type AddAttributeDialogResult = {
  name: string;
  type: CustomAttributeType;
  options?: string[];
};

const ATTRIBUTE_TYPE_OPTIONS: { value: CustomAttributeType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'enum', label: 'Enum (fixed choices)' },
  { value: 'boolean', label: 'Boolean' },
];

@Component({
  selector: 'app-add-attribute-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './add-attribute-dialog.component.html',
  styleUrl: './add-attribute-dialog.component.scss',
})
export class AddAttributeDialogComponent {
  readonly existingNames = input<string[]>([]);
  readonly saved = output<AddAttributeDialogResult>();
  readonly cancelled = output<void>();

  protected readonly typeOptions = ATTRIBUTE_TYPE_OPTIONS;
  protected readonly error = signal<string | null>(null);
  protected readonly optionSeparatorKeys = [ENTER, COMMA] as const;

  protected name = '';
  protected type: CustomAttributeType = 'text';
  protected options: string[] = [];

  protected get showOptionsField(): boolean {
    return this.type === 'enum';
  }

  protected addOptionFromInput(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim();
    if (value) {
      this.addOption(value);
    }
    event.chipInput?.clear();
  }

  protected addOption(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const alreadyExists = this.options.some(
      (option) => option.toLowerCase() === trimmed.toLowerCase(),
    );
    if (alreadyExists) {
      return;
    }

    this.options = [...this.options, trimmed];
    this.error.set(null);
  }

  protected removeOption(option: string): void {
    this.options = this.options.filter((item) => item !== option);
  }

  protected onTypeChange(type: CustomAttributeType): void {
    this.type = type;
    this.error.set(null);
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
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      this.error.set('Name is required.');
      return;
    }

    const isDuplicate = this.existingNames().some(
      (existing) => existing.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) {
      this.error.set('An attribute with this name already exists.');
      return;
    }

    if (this.type === 'enum' && this.options.length === 0) {
      this.error.set('Add at least one option for an enum attribute.');
      return;
    }

    this.saved.emit({
      name: trimmedName,
      type: this.type,
      ...(this.type === 'enum' ? { options: [...this.options] } : {}),
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
