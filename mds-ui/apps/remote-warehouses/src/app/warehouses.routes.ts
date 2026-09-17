import { Routes } from '@angular/router';
import { provideState } from '@ngrx/store';
import { WarehousesPageFacade } from './core/facades/warehouses-page.facade';
import { warehousesFeature } from './core/store/warehouses.reducer';
import { WarehouseEditPageComponent } from './warehouse-edit-page/warehouse-edit-page.component';
import { WarehousesPageComponent } from './warehouses-page/warehouses-page.component';

export const WAREHOUSES_REMOTE_ROUTES: Routes = [
  {
    path: '',
    providers: [provideState(warehousesFeature)],
    children: [
      {
        path: '',
        pathMatch: 'full',
        component: WarehousesPageComponent,
        providers: [WarehousesPageFacade],
      },
      {
        path: 'create',
        component: WarehouseEditPageComponent,
      },
      {
        path: ':warehouseUuid/edit',
        component: WarehouseEditPageComponent,
      },
    ],
  },
];
