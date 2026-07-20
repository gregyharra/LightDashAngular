import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { WarehouseConnection } from '../../../core/models/warehouse.model';
import { WarehouseService } from '../warehouse.service';

@Component({
  selector: 'app-project-warehouse-form',
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
  ],
  templateUrl: './project-warehouse-form.component.html',
  styleUrl: './project-warehouse-form.component.scss',
})
export class ProjectWarehouseFormComponent {
  private readonly warehouseService = inject(WarehouseService);

  readonly projectUuid = input.required<string>();

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly testing = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly testResult = signal<{ success: boolean; message: string } | null>(null);
  protected readonly isEditing = signal(false);

  protected host = '';
  protected port = 8080;
  protected catalog = '';
  protected schema = '';
  protected user = '';
  protected password = '';
  protected ssl = false;
  protected clearPassword = false;
  protected hasExistingPassword = false;

  private loadedFor: string | null = null;

  constructor() {
    effect(() => {
      const uuid = this.projectUuid();
      if (uuid && uuid !== this.loadedFor) {
        this.loadedFor = uuid;
        this.loadConnection(uuid);
      }
    });
  }

  private loadConnection(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.warehouseService.get(projectUuid).subscribe({
      next: (connection) => {
        this.applyConnection(connection);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.loading.set(false);
      },
    });
  }

  private applyConnection(connection: WarehouseConnection): void {
    this.host = connection.host;
    this.port = connection.port || 8080;
    this.catalog = connection.catalog;
    this.schema = connection.schema;
    this.user = connection.user;
    this.ssl = connection.ssl;
    this.hasExistingPassword = connection.hasPassword;
    this.password = '';
    this.clearPassword = false;
    this.isEditing.set(connection.configured);
  }

  protected connectionStatusLabel(): string {
    if (this.loading()) {
      return 'Loading…';
    }
    return this.isEditing() ? 'Configured' : 'Not configured';
  }

  protected connectionStatusClass(): string {
    return this.isEditing()
      ? 'project-warehouse-form__status--ok'
      : 'project-warehouse-form__status--missing';
  }

  protected save(): void {
    const projectUuid = this.projectUuid();

    this.saving.set(true);
    this.error.set(null);
    this.success.set(null);
    this.testResult.set(null);

    const payload = {
      type: 'trino',
      host: this.host.trim(),
      port: Number(this.port),
      catalog: this.catalog.trim(),
      schema: this.schema.trim(),
      user: this.user.trim(),
      ssl: this.ssl,
      ...(this.password.trim() ? { password: this.password } : {}),
      ...(this.clearPassword ? { clearPassword: true } : {}),
    };

    this.warehouseService.upsert(projectUuid, payload).subscribe({
      next: (connection) => {
        this.applyConnection(connection);
        this.isEditing.set(true);
        this.saving.set(false);
        this.success.set('Warehouse connection saved.');
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err));
        this.saving.set(false);
      },
    });
  }

  protected testConnection(): void {
    const projectUuid = this.projectUuid();

    this.testing.set(true);
    this.testResult.set(null);
    this.error.set(null);

    this.warehouseService.test(projectUuid).subscribe({
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
}
