import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '@mds-ui/core';
import { Space } from '@mds-ui/models';

@Injectable({ providedIn: 'root' })
export class SpaceService {
  private readonly api = inject(LightdashApiService);

  list(projectUuid: string): Observable<Space[]> {
    return this.api.get<Space[]>(`/projects/${projectUuid}/spaces`);
  }
}
