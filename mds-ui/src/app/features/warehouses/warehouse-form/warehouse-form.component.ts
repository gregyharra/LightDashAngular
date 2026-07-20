import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  defaultPortForWarehouseType,
  Warehouse,
  WarehouseCreate,
  WarehouseType,
  WAREHOUSE_TYPE_OPTIONS,
  WarehouseUpdate,
} from '../../../core/models/warehouse.model';
import { WarehouseService } from '../../projects/warehouse.service';

@Component({
  selector: 'app-warehouse-form',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  templateUrl: './warehouse-form.component.html',
  styleUrl: './warehouse-form.component.scss',
})
export class WarehouseFormComponent {
  private readonly warehouseService = inject(WarehouseService);

  readonly mode = input.required<'create' | 'edit'>();
  readonly warehouseUuid = input<string | null>(null);
  readonly showActions = input(true);
  readonly compact = input(false);

  readonly saved = output<Warehouse>();
  readonly cancelled = output<void>();

  protected readonly warehouseTypeOptions = WAREHOUSE_TYPE_OPTIONS;
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly testing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly testResult = signal<{ success: boolean; message: string } | null>(null);
  protected readonly isEditing = signal(false);

  protected name = '';
  protected type: WarehouseType = 'trino';
  protected host = '';
  protected port = defaultPortForWarehouseType('trino');
  protected user = '';
  protected password = '';
  protected catalog = '';
  protected schema = '';
  protected ssl = false;
  protected clearPassword = false;
  protected hasExistingPassword = false;

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const mode = this.mode();
      const uuid = this.warehouseUuid();
      if (mode === 'edit' && uuid && uuid !== this.loadedFor) {
        this.loadedFor = uuid;
        this.loadWarehouse(uuid);
      } else if (mode === 'create') {
        this.loadedFor = null;
        this.resetForm();
      }
    });
  }

  private resetForm(): void {
    this.name = '';
    this.type = 'trino';
    this.host = '';
    this.port = defaultPortForWarehouseType('trino');
    this.user = '';
    this.password = '';
    this.catalog = '';
    this.schema = '';
    this.ssl = false;
    this.clearPassword = false;
    this.hasExistingPassword = false;
    this.isEditing.set(false);
    this.loading.set(false);
    this.error.set(null);
    this.success.set(null);
    this.testResult.set(null);
  }

  private loadWarehouse(warehouseUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.warehouseService.get(warehouseUuid).subscribe({
      next: (warehouse) => {
        this.applyWarehouse(warehouse);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private applyWarehouse(warehouse: Warehouse): void {
    this.name = warehouse.name;
    this.type = this.normalizeType(warehouse.type);
    this.host = warehouse.host;
    this.port = warehouse.port || defaultPortForWarehouseType(this.type);
    this.user = warehouse.user;
    this.catalog = warehouse.catalog ?? '';
    this.schema = warehouse.schema ?? '';
    this.ssl = warehouse.ssl;
    this.hasExistingPassword = warehouse.hasPassword;
    this.password = '';
    this.clearPassword = false;
    this.isEditing.set(true);
  }

  private normalizeType(type: string): WarehouseType {
    const match = WAREHOUSE_TYPE_OPTIONS.find((option) => option.value === type);
    return match?.value ?? 'trino';
  }

  protected onTypeChange(): void {
    this.port = defaultPortForWarehouseType(this.type);
  }

  protected catalogLabel(): string {
    return this.type === 'oracle' ? 'Service name' : 'Catalog';
  }

  protected catalogHint(): string | null {
    if (this.type === 'oracle') {
      return 'Optional. Oracle service name or SID.';
    }
    if (this.type === 'trino') {
      return 'Optional. Default catalog for queries.';
    }
    return 'Optional.';
  }

  protected supportsConnectionTest(): boolean {
    return this.type === 'trino';
  }

  protected connectionStatusLabel(): string {
    if (this.loading()) {
      return 'Loading…';
    }
    return this.isEditing() ? 'Configured' : 'New connection';
  }

  protected connectionStatusClass(): string {
    return this.isEditing()
      ? 'warehouse-form__status--ok'
      : 'warehouse-form__status--missing';
  }

  protected save(): void {
    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.testResult.set(null);

    const connectionFields = {
      type: this.type,
      host: this.host.trim(),
      port: Number(this.port),
      user: this.user.trim(),
      ssl: this.ssl,
      ...(this.catalog.trim() ? { catalog: this.catalog.trim() } : {}),
      ...(this.schema.trim() ? { schema: this.schema.trim() } : {}),
      ...(this.password.trim() ? { password: this.password } : {}),
      ...(this.clearPassword ? { clearPassword: true } : {}),
    };

    if (this.mode() === 'create') {
      const payload: WarehouseCreate = {
        name: this.name.trim(),
        ...connectionFields,
      };

      this.warehouseService.create(payload).subscribe({
        next: (warehouse) => {
          this.applyWarehouse(warehouse);
          this.saving.set(false);
          this.success.set('Warehouse created.');
          this.saved.emit(warehouse);
        },
        error: (err) => {
          this.error.set(apiErrorMessage(err));
          this.saving.set(false);
        },
      });
      return;
    }

    const uuid = this.warehouseUuid();
    if (!uuid) {
      this.error.set('Missing warehouse identifier.');
      this.saving.set(false);
      return;
    }

    const payload: WarehouseUpdate = {
      name: this.name.trim(),
      ...connectionFields,
      catalog: this.catalog.trim(),
      schema: this.schema.trim(),
    };

    this.warehouseService.update(uuid, payload).subscribe({
      next: (warehouse) => {
        this.applyWarehouse(warehouse);
        this.saving.set(false);
        this.success.set('Warehouse saved.');
        this.saved.emit(warehouse);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected testConnection(): void {
    const uuid = this.warehouseUuid();
    if (!uuid) {
      this.error.set('Save the warehouse before testing the connection.');
      return;
    }

    if (!this.supportsConnectionTest()) {
      this.testResult.set({
        success: false,
        message: 'Connection testing is only available for Trino warehouses.',
      });
      return;
    }

    this.testing.set(true);
    this.testResult.set(null);
    this.error.set(null);

    this.warehouseService.test(uuid).subscribe({
      next: (result) => {
        this.testResult.set(result);
        this.testing.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.testing.set(false);
      },
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
