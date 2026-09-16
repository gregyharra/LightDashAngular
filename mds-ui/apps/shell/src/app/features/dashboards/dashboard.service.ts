import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  CreateDashboardPayload,
  Dashboard,
  DashboardBasicDetailsWithTileTypes,
  UpdateDashboardPayload,
} from '../../core/models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(LightdashApiService);
  private readonly getCache = new Map<string, Observable<Dashboard>>();

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
    const key = this.getCacheKey(projectUuid, dashboardUuid);
    const cached = this.getCache.get(key);
    if (cached) {
      return cached;
    }

    const request$ = this.api
      .get<Dashboard>(`/projects/${projectUuid}/dashboards/${dashboardUuid}`, {
        apiVersion: 'v2',
      })
      .pipe(
        tap({ error: () => this.getCache.delete(key) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.getCache.set(key, request$);
    return request$;
  }

  create(
    projectUuid: string,
    payload: CreateDashboardPayload,
  ): Observable<Dashboard> {
    return this.api
      .post<Dashboard>(`/projects/${projectUuid}/dashboards`, {
        ...payload,
        tabs: payload.tabs ?? [],
        tiles: payload.tiles ?? [],
      })
      .pipe(tap((dashboard) => this.storeGet(projectUuid, dashboard.uuid, dashboard)));
  }

  update(
    projectUuid: string,
    dashboardUuid: string,
    payload: UpdateDashboardPayload,
  ): Observable<Dashboard> {
    return this.api
      .patch<Dashboard>(
        `/projects/${projectUuid}/dashboards/${dashboardUuid}`,
        payload,
        { apiVersion: 'v2' },
      )
      .pipe(tap((dashboard) => this.storeGet(projectUuid, dashboardUuid, dashboard)));
  }

  private getCacheKey(projectUuid: string, dashboardUuid: string): string {
    return `${projectUuid}:${dashboardUuid}`;
  }

  private storeGet(
    projectUuid: string,
    dashboardUuid: string,
    dashboard: Dashboard,
  ): void {
    this.getCache.set(this.getCacheKey(projectUuid, dashboardUuid), of(dashboard));
  }
}
