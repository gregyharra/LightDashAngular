import { Injectable, inject } from '@angular/core';
import { DashboardService } from '@mds-ui/feature-projects';

@Injectable()
export class DashboardCreatePageFacade {
  private readonly dashboards = inject(DashboardService);
  readonly api = this.dashboards;
}
