import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
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
    MatFormFieldModule,
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

  protected name = '';
  protected type: CustomAttributeType = 'text';
  protected optionsInput = '';

  protected get showOptionsField(): boolean {
    return this.type === 'enum';
  }

  protected get parsedOptions(): string[] {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const raw of this.optionsInput.split(',')) {
      const option = raw.trim();
      if (!option || seen.has(option.toLowerCase())) {
        continue;
      }
      seen.add(option.toLowerCase());
      options.push(option);
    }
    return options;
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

    if (this.type === 'enum' && this.parsedOptions.length === 0) {
      this.error.set('Add at least one option for an enum attribute.');
      return;
    }

    this.saved.emit({
      name: trimmedName,
      type: this.type,
      ...(this.type === 'enum' ? { options: this.parsedOptions } : {}),
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
