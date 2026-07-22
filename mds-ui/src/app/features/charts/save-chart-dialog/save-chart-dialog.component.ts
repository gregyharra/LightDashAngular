import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { Space } from '../../../core/models/space.model';
import { SpaceService } from '../../spaces/space.service';

export type SaveChartDialogData = {
  projectUuid: string;
  suggestedName?: string;
};

export type SaveChartDialogResult =
  | {
      name: string;
      spaceUuid: string;
    }
  | undefined;

@Component({
  selector: 'app-save-chart-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './save-chart-dialog.component.html',
  styleUrl: './save-chart-dialog.component.scss',
})
export class SaveChartDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<SaveChartDialogComponent, SaveChartDialogResult>,
  );
  private readonly spaceService = inject(SpaceService);
  readonly data = inject<SaveChartDialogData>(MAT_DIALOG_DATA);

  protected readonly spaces = signal<Space[]>([]);
  protected readonly spacesLoading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected name = this.data.suggestedName ?? '';
  protected spaceUuid = '';

  constructor() {
    this.spaceService.list(this.data.projectUuid).subscribe({
      next: (spaces) => {
        this.spaces.set(spaces);
        this.spaceUuid = spaces[0]?.uuid ?? '';
        this.spacesLoading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Failed to load spaces.'));
        this.spaces.set([]);
        this.spacesLoading.set(false);
      },
    });
  }

  protected save(): void {
    const trimmedName = this.name.trim();
    if (!trimmedName || !this.spaceUuid) {
      return;
    }

    this.dialogRef.close({
      name: trimmedName,
      spaceUuid: this.spaceUuid,
    });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
