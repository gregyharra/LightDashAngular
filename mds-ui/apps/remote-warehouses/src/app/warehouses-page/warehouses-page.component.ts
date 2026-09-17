import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '@mds-ui/core';
import { WAREHOUSE_TYPE_LABELS, WarehouseListItem } from '@mds-ui/models';
import { WarehousesPageFacade } from '../core/facades/warehouses-page.facade';

@Component({
  selector: 'app-warehouses-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './warehouses-page.component.html',
  styleUrl: './warehouses-page.component.scss',
})
export class WarehousesPageComponent {
  private readonly facade = inject(WarehousesPageFacade);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);

  protected readonly warehouses = this.facade.warehouses;
  protected readonly loading = this.facade.loading;
  protected readonly error = this.facade.error;
  protected readonly deletingUuid = this.facade.deletingUuid;

  constructor() {
    this.facade.load();
  }

  protected warehouseLabel(type: string): string {
    return WAREHOUSE_TYPE_LABELS[type] ?? type;
  }

  protected catalogSchemaLabel(warehouse: WarehouseListItem): string | null {
    const parts = [warehouse.catalog, warehouse.schema].filter(Boolean);
    return parts.length > 0 ? parts.join('.') : null;
  }

  protected formatDate(iso: string): string {
    return this.languageService.formatDate(iso, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected openCreate(): void {
    this.facade.openCreate();
  }

  protected openEdit(warehouseUuid: string): void {
    this.facade.openEdit(warehouseUuid);
  }

  protected deleteWarehouse(event: Event, warehouseUuid: string): void {
    event.stopPropagation();
    if (!confirm(this.translate.instant('warehouses.deleteConfirm'))) {
      return;
    }

    this.facade.delete(warehouseUuid);
  }
}
