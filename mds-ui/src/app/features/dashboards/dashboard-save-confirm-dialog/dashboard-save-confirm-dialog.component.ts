import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';

export type DashboardSaveConfirmDialogData = {
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

@Component({
  selector: 'app-dashboard-save-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p class="dashboard-save-confirm__body">{{ data.body }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" [mat-dialog-close]="false">
        {{ data.cancelLabel ?? 'Cancel' }}
      </button>
      <button mat-flat-button color="primary" type="button" [mat-dialog-close]="true">
        {{ data.confirmLabel ?? 'Save' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .dashboard-save-confirm__body {
      margin: 0;
      max-width: 22rem;
      color: rgba(0, 0, 0, 0.65);
      line-height: 1.4;
    }
  `,
})
export class DashboardSaveConfirmDialogComponent {
  protected readonly data = inject<DashboardSaveConfirmDialogData>(MAT_DIALOG_DATA);
}
