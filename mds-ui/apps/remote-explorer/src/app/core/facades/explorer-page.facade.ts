import { Injectable, inject } from '@angular/core';
import { ChartQueryFacade, ExplorerService } from '@mds-ui/feature-chart-query';

@Injectable()
export class ExplorerPageFacade {
  private readonly chartQuery = inject(ChartQueryFacade);
  private readonly explorer = inject(ExplorerService);
  readonly chartQueryApi = this.chartQuery;
  readonly explorerApi = this.explorer;
}
