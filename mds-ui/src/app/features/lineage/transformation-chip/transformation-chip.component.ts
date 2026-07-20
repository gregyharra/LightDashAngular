import { Component, computed, input } from '@angular/core';
import { ColumnTransformationType } from '../../../core/models/lineage.model';
import {
  TransformationChipMode,
  transformationChipLabel,
  transformationDescription,
} from '../column-transformation.utils';

@Component({
  selector: 'app-transformation-chip',
  template: `
    <span
      class="ld-transform-chip"
      [class]="chipClasses()"
      [attr.title]="description()"
      [attr.aria-label]="description()"
    >
      {{ label() }}
    </span>
  `,
  styleUrl: './transformation-chip.component.scss',
})
export class TransformationChipComponent {
  readonly type = input.required<ColumnTransformationType>();
  readonly mode = input<TransformationChipMode>('full');
  readonly size = input<'sm' | 'md'>('sm');

  protected readonly label = computed(() =>
    transformationChipLabel(this.type(), this.mode()),
  );

  protected readonly description = computed(() => transformationDescription(this.type()));

  protected readonly chipClasses = computed(() => {
    const typeClass = `ld-transform-chip--${this.type()}`;
    const sizeClass = `ld-transform-chip--${this.size()}`;
    const modeClass = this.mode() === 'compact' ? 'ld-transform-chip--compact' : '';
    return [typeClass, sizeClass, modeClass].filter(Boolean).join(' ');
  });
}
