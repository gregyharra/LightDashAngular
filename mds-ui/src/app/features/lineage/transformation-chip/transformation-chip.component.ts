import { Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { ColumnTransformationType } from '../../../core/models/lineage.model';
import {
  TRANSFORMATION_SHORT_LABELS,
  TransformationChipMode,
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
  private readonly translate = inject(TranslateService);

  readonly type = input.required<ColumnTransformationType>();
  readonly mode = input<TransformationChipMode>('full');
  readonly size = input<'sm' | 'md'>('sm');

  protected readonly label = computed(() => {
    const type = this.type();
    return this.mode() === 'compact'
      ? TRANSFORMATION_SHORT_LABELS[type]
      : this.translate.instant(`lineage.transformations.labels.${type}`);
  });

  protected readonly description = computed(() =>
    this.translate.instant(`lineage.transformations.descriptions.${this.type()}`),
  );

  protected readonly chipClasses = computed(() => {
    const typeClass = `ld-transform-chip--${this.type()}`;
    const sizeClass = `ld-transform-chip--${this.size()}`;
    const modeClass = this.mode() === 'compact' ? 'ld-transform-chip--compact' : '';
    return [typeClass, sizeClass, modeClass].filter(Boolean).join(' ');
  });
}
