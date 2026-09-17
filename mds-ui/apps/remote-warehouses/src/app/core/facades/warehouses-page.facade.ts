import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { ApiErrorService } from '@mds-ui/core';
import { WarehouseService } from '@mds-ui/feature-warehouses';
import { TranslateService } from '@ngx-translate/core';
import { WarehousesActions } from '../store/warehouses.actions';
import { warehousesFeature } from '../store/warehouses.reducer';

@Injectable()
export class WarehousesPageFacade {
  private readonly store = inject(Store);
  private readonly warehouseService = inject(WarehouseService);
  private readonly apiErrorService = inject(ApiErrorService);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);

  readonly warehouses = this.store.selectSignal(
    warehousesFeature.selectWarehouses,
  );
  readonly loading = this.store.selectSignal(warehousesFeature.selectLoading);
  readonly error = this.store.selectSignal(warehousesFeature.selectError);
  readonly deletingUuid = this.store.selectSignal(
    warehousesFeature.selectDeletingUuid,
  );

  load(): void {
    this.store.dispatch(WarehousesActions.loadStarted());
    this.warehouseService.list().subscribe({
      next: (warehouses) =>
        this.store.dispatch(WarehousesActions.loadSucceeded({ warehouses })),
      error: (error) =>
        this.store.dispatch(
          WarehousesActions.loadFailed({
            error: this.apiErrorService.showTransient(
              error,
              this.translate.instant('warehouses.loadError'),
            ),
          }),
        ),
    });
  }

  delete(warehouseUuid: string): void {
    this.store.dispatch(WarehousesActions.deleteStarted({ warehouseUuid }));
    this.warehouseService.delete(warehouseUuid).subscribe({
      next: () =>
        this.store.dispatch(
          WarehousesActions.deleteSucceeded({ warehouseUuid }),
        ),
      error: (error) =>
        this.store.dispatch(
          WarehousesActions.deleteFailed({
            error: this.apiErrorService.showTransient(
              error,
              this.translate.instant('warehouses.deleteError'),
            ),
          }),
        ),
    });
  }

  openCreate(): void {
    void this.router.navigate(['/settings/warehouses', 'create']);
  }

  openEdit(warehouseUuid: string): void {
    void this.router.navigate(['/settings/warehouses', warehouseUuid, 'edit']);
  }
}
