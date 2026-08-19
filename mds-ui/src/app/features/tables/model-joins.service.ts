import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  ModelJoinCreate,
  ModelJoinUpdate,
  ModelJoinView,
} from '../../core/models/model-join.model';

@Injectable({ providedIn: 'root' })
export class ModelJoinsService {
  private readonly api = inject(LightdashApiService);

  list(projectUuid: string, sourceModelId?: string | null): Observable<ModelJoinView[]> {
    const query = sourceModelId
      ? `?sourceModelId=${encodeURIComponent(sourceModelId)}`
      : '';
    return this.api.get<ModelJoinView[]>(
      `/projects/${projectUuid}/model-joins${query}`,
    );
  }

  create(projectUuid: string, payload: ModelJoinCreate): Observable<ModelJoinView> {
    return this.api.post<ModelJoinView>(
      `/projects/${projectUuid}/model-joins`,
      payload,
    );
  }

  update(
    projectUuid: string,
    joinUuid: string,
    payload: ModelJoinUpdate,
  ): Observable<ModelJoinView> {
    return this.api.put<ModelJoinView>(
      `/projects/${projectUuid}/model-joins/${encodeURIComponent(joinUuid)}`,
      payload,
    );
  }

  delete(projectUuid: string, joinUuid: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(
      `/projects/${projectUuid}/model-joins/${encodeURIComponent(joinUuid)}`,
    );
  }
}
