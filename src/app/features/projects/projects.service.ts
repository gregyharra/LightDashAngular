import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { LightdashApiService } from '../../core/api/lightdash-api.service';
import { OrganizationProject } from '../../core/models/organization.model';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly api = inject(LightdashApiService);

  list(): Observable<OrganizationProject[]> {
    return this.api.get<OrganizationProject[]>('/org/projects');
  }
}
