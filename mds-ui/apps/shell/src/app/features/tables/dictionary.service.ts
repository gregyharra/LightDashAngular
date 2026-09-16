import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  DictionaryColumnUpdate,
  DictionaryEntry,
  DictionaryListResponse,
  DictionaryModelUpdate,
  DictionaryQuality,
} from '../../core/models/dictionary.model';

@Injectable({ providedIn: 'root' })
export class DictionaryService {
  private readonly api = inject(LightdashApiService);

  list(projectUuid: string): Observable<DictionaryListResponse> {
    return this.api.get<DictionaryListResponse>(
      `/projects/${projectUuid}/dictionary`,
    );
  }

  quality(projectUuid: string): Observable<DictionaryQuality> {
    return this.api.get<DictionaryQuality>(
      `/projects/${projectUuid}/dictionary/quality`,
    );
  }

  get(projectUuid: string, uniqueId: string): Observable<DictionaryEntry> {
    return this.api.get<DictionaryEntry>(
      `/projects/${projectUuid}/dictionary/${encodeURIComponent(uniqueId)}`,
    );
  }

  updateModel(
    projectUuid: string,
    uniqueId: string,
    payload: DictionaryModelUpdate,
  ): Observable<DictionaryEntry> {
    return this.api.put<DictionaryEntry>(
      `/projects/${projectUuid}/dictionary/${encodeURIComponent(uniqueId)}`,
      payload,
    );
  }

  updateColumn(
    projectUuid: string,
    uniqueId: string,
    columnName: string,
    payload: DictionaryColumnUpdate,
  ): Observable<DictionaryEntry> {
    return this.api.put<DictionaryEntry>(
      `/projects/${projectUuid}/dictionary/${encodeURIComponent(uniqueId)}/columns/${encodeURIComponent(columnName)}`,
      payload,
    );
  }
}
