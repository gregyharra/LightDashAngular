import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { ProjectSummary } from '../../core/models/project.model';

export interface ProjectDetail extends ProjectSummary {
  warehouseUuid?: string | null;
  warehouseName?: string | null;
}

export interface ProjectCreate {
  name: string;
  warehouseUuid?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  warehouseUuid?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly api = inject(LightdashApiService);

  list(): Observable<ProjectSummary[]> {
    return this.api.get<ProjectSummary[]>('/projects');
  }

  create(body: ProjectCreate): Observable<ProjectDetail> {
    return this.api.post<ProjectDetail>('/projects', body);
  }

  get(projectUuid: string): Observable<ProjectDetail> {
    return this.api.get<ProjectDetail>(`/projects/${projectUuid}`);
  }

  update(projectUuid: string, body: ProjectUpdate): Observable<ProjectDetail> {
    return this.api.patch<ProjectDetail>(`/projects/${projectUuid}`, body);
  }
}
