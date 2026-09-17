import { Injectable, inject } from '@angular/core';
import { ChartQueryFacade, ChartService, ExplorerService } from '@mds-ui/feature-chart-query';

@Injectable()
export class ChartViewPageFacade {
  private readonly chartQuery = inject(ChartQueryFacade);
  private readonly charts = inject(ChartService);
  private readonly explorer = inject(ExplorerService);
  readonly chartQueryApi = this.chartQuery;
  readonly chartsApi = this.charts;
  readonly explorerApi = this.explorer;
}
