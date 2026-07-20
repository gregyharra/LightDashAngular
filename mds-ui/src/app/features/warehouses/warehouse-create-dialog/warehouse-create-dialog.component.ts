import { Component, inject } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { Warehouse } from '../../../core/models/warehouse.model';
import { WarehouseFormComponent } from '../warehouse-form/warehouse-form.component';

export type WarehouseCreateDialogData = {
  suggestedName?: string;
};

@Component({
  selector: 'app-warehouse-create-dialog',
  imports: [MatDialogModule, WarehouseFormComponent],
  template: `
    <h2 mat-dialog-title>Create warehouse</h2>
    <mat-dialog-content>
      <app-warehouse-form
        mode="create"
        [compact]="true"
        (saved)="onSaved($event)"
        (cancelled)="close()"
      />
    </mat-dialog-content>
  `,
})
export class WarehouseCreateDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<WarehouseCreateDialogComponent, Warehouse | undefined>,
  );
  readonly data = inject<WarehouseCreateDialogData>(MAT_DIALOG_DATA, { optional: true });

  protected onSaved(warehouse: Warehouse): void {
    this.dialogRef.close(warehouse);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }
}
