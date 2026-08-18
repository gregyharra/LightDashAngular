import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { ExportFormat } from './export.models';

export type ExportDialogData = {
  format: ExportFormat;
  csvMaxLimit: number;
  filenameBase: string;
};

export type ExportDialogResult = { overrideRowCap: boolean } | undefined;

@Component({
  selector: 'app-export-dialog',
  imports: [DecimalPipe, MatButtonModule, MatDialogModule],
  templateUrl: './export-dialog.component.html',
  styleUrl: './export-dialog.component.scss',
})
export class ExportDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<ExportDialogComponent, ExportDialogResult>,
  );
  readonly data = inject<ExportDialogData>(MAT_DIALOG_DATA);

  protected showOverrideWarning = false;

  protected get formatLabel(): string {
    return this.data.format === 'xlsx' ? 'Excel' : 'CSV';
  }

  protected get csvMaxLimitLabel(): string {
    return this.data.csvMaxLimit.toLocaleString('en-US');
  }

  protected startOverrideConfirm(): void {
    this.showOverrideWarning = true;
  }

  confirmCapped(): void {
    this.dialogRef.close({ overrideRowCap: false });
  }

  confirmOverride(): void {
    this.dialogRef.close({ overrideRowCap: true });
  }
}
