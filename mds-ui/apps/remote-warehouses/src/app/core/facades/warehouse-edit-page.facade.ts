import { Injectable, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Injectable()
export class WarehouseEditPageFacade {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly warehouseUuid = signal<string | null>(null);
  readonly isCreateMode = signal(true);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const warehouseUuid = params.get('warehouseUuid');
      this.warehouseUuid.set(warehouseUuid);
      this.isCreateMode.set(!warehouseUuid);
    });
  }

  close(): void {
    void this.router.navigate(['/settings/warehouses']);
  }
}
