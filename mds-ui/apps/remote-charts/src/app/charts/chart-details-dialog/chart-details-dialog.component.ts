import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TranslatePipe } from '@ngx-translate/core';

export type ChartDetailsDialogData = {
  name: string;
  description: string;
};

export type ChartDetailsDialogResult =
  | {
      name: string;
      description: string;
    }
  | undefined;

@Component({
  selector: 'app-chart-details-dialog',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    TranslatePipe,
  ],
  templateUrl: './chart-details-dialog.component.html',
  styleUrl: './chart-details-dialog.component.scss',
})
export class ChartDetailsDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<ChartDetailsDialogComponent, ChartDetailsDialogResult>,
  );
  readonly data = inject<ChartDetailsDialogData>(MAT_DIALOG_DATA);

  protected name = this.data.name;
  protected description = this.data.description;

  protected get canApply(): boolean {
    return this.name.trim().length > 0;
  }

  protected apply(): void {
    const trimmedName = this.name.trim();
    if (!trimmedName) {
      return;
    }

    this.dialogRef.close({
      name: trimmedName,
      description: this.description.trim(),
    });
  }

  protected cancel(): void {
    this.dialogRef.close(undefined);
  }
}
