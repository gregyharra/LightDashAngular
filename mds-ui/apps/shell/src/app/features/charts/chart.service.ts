import { Injectable, inject } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  CreateSavedChartPayload,
  SavedChart,
  SavedChartBasic,
  UpdateSavedChartPayload,
} from '../../core/models/chart.model';

@Injectable({ providedIn: 'root' })
export class ChartService {
  private readonly api = inject(LightdashApiService);
  private readonly getCache = new Map<string, Observable<SavedChart>>();

  list(projectUuid: string): Observable<SavedChartBasic[]> {
    return this.api.get<SavedChartBasic[]>(
      `/projects/${projectUuid}/saved`,
    );
  }

  get(projectUuid: string, chartUuid: string): Observable<SavedChart> {
    const key = this.getCacheKey(projectUuid, chartUuid);
    const cached = this.getCache.get(key);
    if (cached) {
      return cached;
    }

    const request$ = this.api
      .get<SavedChart>(`/projects/${projectUuid}/saved/${chartUuid}`)
      .pipe(
        tap({ error: () => this.getCache.delete(key) }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.getCache.set(key, request$);
    return request$;
  }

  create(
    projectUuid: string,
    payload: CreateSavedChartPayload,
  ): Observable<SavedChart> {
    return this.api
      .post<SavedChart>(`/projects/${projectUuid}/saved`, payload)
      .pipe(tap((chart) => this.storeGet(projectUuid, chart.uuid, chart)));
  }

  update(
    projectUuid: string,
    chartUuid: string,
    payload: UpdateSavedChartPayload,
  ): Observable<SavedChart> {
    return this.api
      .patch<SavedChart>(
        `/projects/${projectUuid}/saved/${chartUuid}`,
        payload,
      )
      .pipe(tap((chart) => this.storeGet(projectUuid, chartUuid, chart)));
  }

  delete(projectUuid: string, chartUuid: string): Observable<unknown> {
    return this.api
      .delete<unknown>(`/projects/${projectUuid}/saved/${chartUuid}`)
      .pipe(tap(() => this.getCache.delete(this.getCacheKey(projectUuid, chartUuid))));
  }

  private getCacheKey(projectUuid: string, chartUuid: string): string {
    return `${projectUuid}:${chartUuid}`;
  }

  private storeGet(
    projectUuid: string,
    chartUuid: string,
    chart: SavedChart,
  ): void {
    this.getCache.set(this.getCacheKey(projectUuid, chartUuid), of(chart));
  }
}
