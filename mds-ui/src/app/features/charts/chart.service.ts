import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { SavedChart, SavedChartBasic } from '../../core/models/chart.model';

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
}
