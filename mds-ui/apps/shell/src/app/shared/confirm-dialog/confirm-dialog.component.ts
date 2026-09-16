import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

export type ConfirmDialogData = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

/** Result is `true` when confirmed; otherwise `undefined`. */
export type ConfirmDialogResult = true | undefined;

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>
      {{ data.title ?? ('common.confirm' | translate) }}
    </h2>
    <mat-dialog-content>
      <p class="confirm-dialog__message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-stroked-button type="button" mat-dialog-close>
        {{ data.cancelLabel ?? ('common.cancel' | translate) }}
      </button>
      <button mat-flat-button color="warn" type="button" (click)="confirm()">
        {{ data.confirmLabel ?? ('common.delete' | translate) }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .confirm-dialog__message {
      margin: 0;
      max-width: 28rem;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
  `,
})
export class ConfirmDialogComponent {
  private readonly dialogRef = inject(
    MatDialogRef<ConfirmDialogComponent, ConfirmDialogResult>,
  );
  readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);

  protected confirm(): void {
    this.dialogRef.close(true);
  }
}
