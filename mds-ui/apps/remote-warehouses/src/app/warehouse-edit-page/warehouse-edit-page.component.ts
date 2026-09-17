import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';
import { WarehouseFormComponent } from '@mds-ui/feature-warehouses';
import { WarehouseEditPageFacade } from '../core/facades/warehouse-edit-page.facade';

@Component({
  selector: 'app-warehouse-edit-page',
  imports: [RouterLink, MatIconModule, WarehouseFormComponent, TranslatePipe],
  templateUrl: './warehouse-edit-page.component.html',
  styleUrl: './warehouse-edit-page.component.scss',
  providers: [WarehouseEditPageFacade],
})
export class WarehouseEditPageComponent {
  private readonly facade = inject(WarehouseEditPageFacade);

  protected readonly warehouseUuid = this.facade.warehouseUuid;
  protected readonly isCreateMode = this.facade.isCreateMode;

  protected onSaved(): void {
    this.facade.close();
  }

  protected onCancelled(): void {
    this.facade.close();
  }
}
