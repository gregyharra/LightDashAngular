import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import {
  GitProvider,
  ProjectRepoStatus,
  ProjectSummary,
} from '../../core/models/project.model';

export interface ProjectDetail extends ProjectSummary {
  warehouseUuid?: string | null;
  warehouseName?: string | null;
}

export interface ProjectCreate {
  name: string;
  warehouseUuid?: string | null;
  gitRepoUrl?: string | null;
  gitDefaultBranch?: string;
  gitProvider?: GitProvider | null;
  gitSubdirectory?: string | null;
  gitToken?: string | null;
  dbtProjectPath?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  warehouseUuid?: string | null;
  gitRepoUrl?: string | null;
  gitDefaultBranch?: string;
  gitProvider?: GitProvider | null;
  gitSubdirectory?: string | null;
  gitToken?: string | null;
  clearGitToken?: boolean;
  dbtProjectPath?: string | null;
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

  getRepoStatus(projectUuid: string): Observable<ProjectRepoStatus> {
    return this.api.get<ProjectRepoStatus>(`/projects/${projectUuid}/repo`);
  }

  syncRepo(projectUuid: string): Observable<ProjectRepoStatus> {
    return this.api.post<ProjectRepoStatus>(`/projects/${projectUuid}/sync`, {});
  }

  desyncRepo(projectUuid: string): Observable<ProjectRepoStatus> {
    return this.api.post<ProjectRepoStatus>(`/projects/${projectUuid}/desync`, {});
  }

  delete(projectUuid: string): Observable<null> {
    return this.api.delete<null>(`/projects/${projectUuid}`);
  }
}
