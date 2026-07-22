import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
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

  list(projectUuid: string): Observable<SavedChartBasic[]> {
    return this.api.get<SavedChartBasic[]>(
      `/projects/${projectUuid}/saved`,
    );
  }

  get(projectUuid: string, chartUuid: string): Observable<SavedChart> {
    return this.api.get<SavedChart>(
      `/projects/${projectUuid}/saved/${chartUuid}`,
    );
  }

  create(
    projectUuid: string,
    payload: CreateSavedChartPayload,
  ): Observable<SavedChart> {
    return this.api.post<SavedChart>(`/projects/${projectUuid}/saved`, payload);
  }

  update(
    projectUuid: string,
    chartUuid: string,
    payload: UpdateSavedChartPayload,
  ): Observable<SavedChart> {
    return this.api.patch<SavedChart>(
      `/projects/${projectUuid}/saved/${chartUuid}`,
      payload,
    );
  }

  delete(projectUuid: string, chartUuid: string): Observable<unknown> {
    return this.api.delete<unknown>(
      `/projects/${projectUuid}/saved/${chartUuid}`,
    );
  }
}
