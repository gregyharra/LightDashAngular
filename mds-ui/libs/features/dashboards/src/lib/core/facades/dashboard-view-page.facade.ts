import { Injectable, inject } from '@angular/core';
import {
  ChartQueryFacade,
  ChartService,
  DashboardService,
  ExplorerService,
} from '@mds-ui/core';

@Injectable()
export class DashboardViewPageFacade {
  private readonly chartQuery = inject(ChartQueryFacade);
  private readonly charts = inject(ChartService);
  private readonly explorer = inject(ExplorerService);
  private readonly dashboards = inject(DashboardService);
  readonly chartQueryApi = this.chartQuery;
  readonly chartsApi = this.charts;
  readonly explorerApi = this.explorer;
  readonly dashboardsApi = this.dashboards;
}
