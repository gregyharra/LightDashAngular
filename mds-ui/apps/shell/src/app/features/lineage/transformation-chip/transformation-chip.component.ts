import { Component, computed, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ColumnTransformationType } from '../../../core/models/lineage.model';
import {
  TRANSFORMATION_SHORT_LABELS,
  TransformationChipMode,
  transformationTranslationKey,
} from '../column-transformation.utils';

@Component({
  selector: 'app-transformation-chip',
  imports: [TranslatePipe],
  template: `
    <span
      class="ld-transform-chip"
      [class]="chipClasses()"
      [attr.title]="descriptionKey() | translate"
      [attr.aria-label]="descriptionKey() | translate"
    >
      @if (mode() === 'compact') {
        {{ shortLabel() }}
      } @else {
        {{ labelKey() | translate }}
      }
    </span>
  `,
  styleUrl: './transformation-chip.component.scss',
})
export class TransformationChipComponent {
  readonly type = input.required<ColumnTransformationType>();
  readonly mode = input<TransformationChipMode>('full');
  readonly size = input<'sm' | 'md'>('sm');

  protected readonly shortLabel = computed(
    () => TRANSFORMATION_SHORT_LABELS[this.type()],
  );
  protected readonly labelKey = computed(
    () =>
      `lineage.transformations.labels.${transformationTranslationKey(this.type())}`,
  );
  protected readonly descriptionKey = computed(
    () =>
      `lineage.transformations.descriptions.${transformationTranslationKey(this.type())}`,
  );

  protected readonly chipClasses = computed(() => {
    const typeClass = `ld-transform-chip--${this.type()}`;
    const sizeClass = `ld-transform-chip--${this.size()}`;
    const modeClass = this.mode() === 'compact' ? 'ld-transform-chip--compact' : '';
    return [typeClass, sizeClass, modeClass].filter(Boolean).join(' ');
  });
}
