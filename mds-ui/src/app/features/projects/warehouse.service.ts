import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  WarehouseConnection,
  WarehouseConnectionTestResult,
  WarehouseConnectionUpsert,
} from '../../core/models/warehouse.model';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private readonly api = inject(LightdashApiService);

  get(projectUuid: string): Observable<WarehouseConnection> {
    return this.api.get<WarehouseConnection>(`/projects/${projectUuid}/warehouse`);
  }

  upsert(projectUuid: string, body: WarehouseConnectionUpsert): Observable<WarehouseConnection> {
    return this.api.put<WarehouseConnection>(`/projects/${projectUuid}/warehouse`, body);
  }

  test(projectUuid: string): Observable<WarehouseConnectionTestResult> {
    return this.api.post<WarehouseConnectionTestResult>(
      `/projects/${projectUuid}/warehouse/test`,
      {},
    );
  }
}
