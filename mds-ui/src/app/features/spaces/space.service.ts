import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { Space } from '../../core/models/space.model';

@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly api = inject(LightdashApiService);

  list(projectUuid: string): Observable<Space[]> {
    return this.api.get<Space[]>(`/projects/${projectUuid}/spaces`);
  }
}
