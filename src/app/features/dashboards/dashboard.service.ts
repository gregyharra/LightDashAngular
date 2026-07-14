import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  CreateDashboardPayload,
  Dashboard,
  DashboardBasicDetailsWithTileTypes,
} from '../../core/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(LightdashApiService);

  list(
    projectUuid: string,
    includePrivate = false,
  ): Observable<DashboardBasicDetailsWithTileTypes[]> {
    return this.api.get<DashboardBasicDetailsWithTileTypes[]>(
      `/projects/${projectUuid}/dashboards`,
      { params: { includePrivate } },
    );
  }

  get(projectUuid: string, dashboardUuid: string): Observable<Dashboard> {
    return this.api.get<Dashboard>(
      `/projects/${projectUuid}/dashboards/${dashboardUuid}`,
      { apiVersion: 'v2' },
    );
  }

  create(
    projectUuid: string,
    payload: CreateDashboardPayload,
  ): Observable<Dashboard> {
    return this.api.post<Dashboard>(`/projects/${projectUuid}/dashboards`, {
      ...payload,
      tabs: payload.tabs ?? [],
      tiles: payload.tiles ?? [],
    });
  }
}
