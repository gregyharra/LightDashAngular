import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { OrganizationProject } from '../../core/models/organization.model';

export interface ProjectDetail extends OrganizationProject {
  warehouseUuid?: string | null;
  warehouseName?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  warehouseUuid?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly api = inject(LightdashApiService);

  list(): Observable<OrganizationProject[]> {
    return this.api.get<OrganizationProject[]>('/org/projects');
  }

  get(projectUuid: string): Observable<ProjectDetail> {
    return this.api.get<ProjectDetail>(`/projects/${projectUuid}`);
  }

  update(projectUuid: string, body: ProjectUpdate): Observable<ProjectDetail> {
    return this.api.patch<ProjectDetail>(`/projects/${projectUuid}`, body);
  }
}
