import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '@mds-ui/core';
import { ProjectDbtTree, ProjectLineage } from '@mds-ui/models';

@Injectable({ providedIn: 'root' })
export class LineageService {
  private readonly api = inject(LightdashApiService);

  getProjectLineage(projectUuid: string): Observable<ProjectLineage> {
    return this.api.get<ProjectLineage>(`/projects/${projectUuid}/lineage`);
  }

  getDbtTree(projectUuid: string): Observable<ProjectDbtTree> {
    return this.api.get<ProjectDbtTree>(`/projects/${projectUuid}/dbt-tree`);
  }
}
