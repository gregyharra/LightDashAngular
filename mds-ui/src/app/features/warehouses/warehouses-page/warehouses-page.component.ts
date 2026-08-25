import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  WAREHOUSE_TYPE_LABELS,
  WarehouseListItem,
} from '../../../core/models/warehouse.model';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { WarehouseService } from '../../projects/warehouse.service';

@Component({
  selector: 'app-warehouses-page',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './warehouses-page.component.html',
  styleUrl: './warehouses-page.component.scss',
})
export class WarehousesPageComponent {
  private readonly warehouseService = inject(WarehouseService);
  private readonly apiErrorService = inject(ApiErrorService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);

  protected readonly warehouses = signal<WarehouseListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deletingUuid = signal<string | null>(null);

  constructor() {
    this.loadWarehouses();
  }

  private loadWarehouses(): void {
    this.loading.set(true);
    this.warehouseService.list().subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(
          this.apiErrorService.showTransient(err, this.translate.instant('warehouses.loadError')),
        );
        this.loading.set(false);
      },
    });
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
    void this.router.navigate(['/settings/warehouses', 'create']);
  }

  protected openEdit(warehouseUuid: string): void {
    void this.router.navigate(['/settings/warehouses', warehouseUuid, 'edit']);
  }

  protected deleteWarehouse(event: Event, warehouseUuid: string): void {
    event.stopPropagation();
    if (!confirm(this.translate.instant('warehouses.deleteConfirm'))) {
      return;
    }

    this.deletingUuid.set(warehouseUuid);
    this.warehouseService.delete(warehouseUuid).subscribe({
      next: () => {
        this.warehouses.update((items) =>
          items.filter((item) => item.warehouseUuid !== warehouseUuid),
        );
        this.deletingUuid.set(null);
      },
      error: (err) => {
        this.error.set(
          this.apiErrorService.showTransient(err, this.translate.instant('warehouses.deleteError')),
        );
        this.deletingUuid.set(null);
      },
    });
  }
}
