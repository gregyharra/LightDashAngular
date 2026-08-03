import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { WarehouseFormComponent } from '../warehouse-form/warehouse-form.component';

@Component({
  selector: 'app-warehouse-edit-page',
  imports: [RouterLink, MatIconModule, WarehouseFormComponent],
  templateUrl: './warehouse-edit-page.component.html',
  styleUrl: './warehouse-edit-page.component.scss',
})
export class WarehouseEditPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly warehouseUuid = signal<string | null>(null);
  protected readonly isCreateMode = signal(true);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const uuid = params.get('warehouseUuid');
      this.warehouseUuid.set(uuid);
      this.isCreateMode.set(!uuid);
    });
  }

  protected onSaved(): void {
    void this.router.navigate(['/settings/warehouses']);
  }

  protected onCancelled(): void {
    void this.router.navigate(['/settings/warehouses']);
  }
}
