import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Warehouse } from '@mds-ui/models';
import { Observable } from 'rxjs';
import {
  WarehouseCreateDialogComponent,
  WarehouseCreateDialogData,
} from './warehouse-create-dialog.component';

@Injectable({ providedIn: 'root' })
export class WarehouseCreateDialogFacade {
  private readonly dialog = inject(MatDialog);

  open(suggestedName?: string): Observable<Warehouse | undefined> {
    return this.dialog
      .open<
        WarehouseCreateDialogComponent,
        WarehouseCreateDialogData,
        Warehouse | undefined
      >(WarehouseCreateDialogComponent, {
        width: '720px',
        panelClass: 'warehouse-create-dialog-panel',
        data: { suggestedName },
      })
      .afterClosed();
  }
}
