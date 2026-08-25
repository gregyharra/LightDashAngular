import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { ColumnTransformationType } from '../../../core/models/lineage.model';
import {
  TRANSFORMATION_TYPES,
  TransformationChipMode,
  transformationTranslationKey,
} from '../column-transformation.utils';
import { TransformationChipComponent } from '../transformation-chip/transformation-chip.component';

@Component({
  selector: 'app-transformation-legend',
  imports: [TransformationChipComponent, TranslatePipe],
  templateUrl: './transformation-legend.component.html',
  styleUrl: './transformation-legend.component.scss',
})
export class TransformationLegendComponent {
  readonly chipMode = input<TransformationChipMode>('compact');
  readonly activeFilter = input<ColumnTransformationType | null>(null);

  readonly chipModeChange = output<TransformationChipMode>();
  readonly filterChange = output<ColumnTransformationType | null>();

  protected readonly types = TRANSFORMATION_TYPES;
  protected readonly translationKey = transformationTranslationKey;

  protected setChipMode(mode: TransformationChipMode): void {
    this.chipModeChange.emit(mode);
  }

  protected toggleFilter(type: ColumnTransformationType): void {
    this.filterChange.emit(this.activeFilter() === type ? null : type);
  }
}
