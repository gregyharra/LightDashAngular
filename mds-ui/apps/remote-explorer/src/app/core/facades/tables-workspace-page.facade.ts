import { Injectable, inject } from '@angular/core';
import { ChartQueryFacade, ChartService, ExplorerService } from '@mds-ui/feature-chart-query';

@Injectable()
export class TablesWorkspacePageFacade {
  private readonly chartQuery = inject(ChartQueryFacade);
  private readonly explorer = inject(ExplorerService);
  private readonly charts = inject(ChartService);
  readonly chartQueryApi = this.chartQuery;
  readonly explorerApi = this.explorer;
  readonly chartsApi = this.charts;
}
