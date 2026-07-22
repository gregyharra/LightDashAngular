import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  WAREHOUSE_TYPE_LABELS,
  WarehouseListItem,
} from '../../../core/models/warehouse.model';
import { ApiErrorService } from '../../../core/api/api-error.service';
import { WarehouseService } from '../../projects/warehouse.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { SettingsSidebarNavComponent } from '../../../layout/settings-sidebar-nav/settings-sidebar-nav.component';

@Component({
  selector: 'app-warehouses-page',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ResizableSidebarDirective,
    SettingsSidebarNavComponent,
  ],
  templateUrl: './warehouses-page.component.html',
  styleUrl: './warehouses-page.component.scss',
})
export class WarehousesPageComponent {
  private readonly warehouseService = inject(WarehouseService);
  private readonly apiErrorService = inject(ApiErrorService);
  private readonly router = inject(Router);

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
        this.error.set(this.apiErrorService.showTransient(err, 'Failed to load warehouses.'));
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
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  protected openCreate(): void {
    void this.router.navigate(['/warehouses', 'create']);
  }

  protected openEdit(warehouseUuid: string): void {
    void this.router.navigate(['/warehouses', warehouseUuid, 'edit']);
  }

  protected deleteWarehouse(event: Event, warehouseUuid: string): void {
    event.stopPropagation();
    if (!confirm('Delete this warehouse connection? Projects using it will be unassigned.')) {
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
        this.error.set(this.apiErrorService.showTransient(err, 'Failed to delete warehouse.'));
        this.deletingUuid.set(null);
      },
    });
  }
}
