import { Injectable, inject } from '@angular/core';
import { ChartService } from '@mds-ui/core';

@Injectable()
export class ChartsListPageFacade {
  private readonly charts = inject(ChartService);
  list(projectUuid: string) { return this.charts.list(projectUuid); }
}
