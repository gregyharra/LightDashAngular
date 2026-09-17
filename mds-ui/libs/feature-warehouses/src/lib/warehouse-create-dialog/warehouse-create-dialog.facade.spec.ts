import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { WarehouseCreateDialogComponent } from './warehouse-create-dialog.component';
import { WarehouseCreateDialogFacade } from './warehouse-create-dialog.facade';

describe('WarehouseCreateDialogFacade', () => {
  it('opens the shared warehouse dialog with the suggested name', () => {
    const afterClosed = of(undefined);
    const dialog = {
      open: jest.fn().mockReturnValue({ afterClosed: () => afterClosed }),
    };

    TestBed.configureTestingModule({
      providers: [
        WarehouseCreateDialogFacade,
        { provide: MatDialog, useValue: dialog },
      ],
    });

    const facade = TestBed.inject(WarehouseCreateDialogFacade);

    expect(facade.open('Demo warehouse')).toBe(afterClosed);
    expect(dialog.open).toHaveBeenCalledWith(WarehouseCreateDialogComponent, {
      width: '720px',
      panelClass: 'warehouse-create-dialog-panel',
      data: { suggestedName: 'Demo warehouse' },
    });
  });
});
