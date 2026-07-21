import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  Warehouse,
  WarehouseCreate,
  WarehouseListItem,
  WarehouseTestConnection,
  WarehouseTestResult,
  WarehouseUpdate,
} from '../../core/models/warehouse.model';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private readonly api = inject(LightdashApiService);

  list(): Observable<WarehouseListItem[]> {
    return this.api.get<WarehouseListItem[]>('/warehouses');
  }

  get(warehouseUuid: string): Observable<Warehouse> {
    return this.api.get<Warehouse>(`/warehouses/${warehouseUuid}`);
  }

  create(body: WarehouseCreate): Observable<Warehouse> {
    return this.api.post<Warehouse>('/warehouses', body);
  }

  update(warehouseUuid: string, body: WarehouseUpdate): Observable<Warehouse> {
    return this.api.patch<Warehouse>(`/warehouses/${warehouseUuid}`, body);
  }

  delete(warehouseUuid: string): Observable<null> {
    return this.api.delete<null>(`/warehouses/${warehouseUuid}`);
  }

  test(warehouseUuid: string): Observable<WarehouseTestResult> {
    return this.api.post<WarehouseTestResult>(`/warehouses/${warehouseUuid}/test`, {});
  }

  testConnection(body: WarehouseTestConnection): Observable<WarehouseTestResult> {
    return this.api.post<WarehouseTestResult>('/warehouses/test', body);
  }
}
