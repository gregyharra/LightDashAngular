import { Component, effect, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { ChartKind } from '../../../core/models/chart.model';
import {
  DashboardDimensionFilter,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import { FieldId, MetricQuery, QueryResults, TimeTravelConfig } from '../../../core/models/explore.model';
import { ChartService } from '../../charts/chart.service';
import { ChartVisualizationComponent } from '../../charts/chart-visualization/chart-visualization.component';
import { ExplorerService } from '../../explorer/explorer.service';
import {
  applyDashboardContextToMetricQuery,
} from '../dashboard-filters';

@Component({
  selector: 'app-dashboard-chart-tile',
  imports: [MatIconModule, MatProgressSpinnerModule, ChartVisualizationComponent],
  templateUrl: './dashboard-chart-tile.component.html',
  styleUrl: './dashboard-chart-tile.component.scss',
})
export class DashboardChartTileComponent {
  private readonly chartService = inject(ChartService);
  private readonly explorerService = inject(ExplorerService);

  readonly projectUuid = input.required<string>();
  readonly savedChartUuid = input<string | null>(null);
  readonly dashboardFilters = input<DashboardDimensionFilter[]>([]);
  readonly dateZoomGranularity = input<DateZoomGranularity>('Month');
  readonly timeTravel = input<TimeTravelConfig | null>(null);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly chartKind = signal<ChartKind>('vertical_bar');
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly xField = signal<FieldId | null>(null);
  protected readonly yField = signal<FieldId | null>(null);

  constructor() {
    effect((onCleanup) => {
      const projectUuid = this.projectUuid();
      const savedChartUuid = this.savedChartUuid();
      const dashboardFilters = this.dashboardFilters();
      const dateZoomGranularity = this.dateZoomGranularity();
      const timeTravel = this.timeTravel();

      if (!savedChartUuid) {
        this.loading.set(false);
        this.error.set(null);
        this.queryResults.set(null);
        return;
      }

      this.loading.set(true);
      this.error.set(null);
      this.queryResults.set(null);

      const sub = this.chartService
        .get(projectUuid, savedChartUuid)
        .pipe(
          switchMap((chart) => {
            this.chartKind.set(chart.chartConfig.type);
            this.xField.set(
              chart.chartConfig.xField ?? chart.metricQuery.dimensions[0] ?? null,
            );
            this.yField.set(
              chart.chartConfig.yField ?? chart.metricQuery.metrics[0] ?? null,
            );

            const metricQuery = this.applyDashboardContext(
              chart.metricQuery,
              dashboardFilters,
              dateZoomGranularity,
              timeTravel,
            );

            return this.explorerService.runQuery(projectUuid, metricQuery);
          }),
          catchError(() => {
            this.error.set('Failed to load chart.');
            this.loading.set(false);
            return EMPTY;
          }),
        )
        .subscribe({
          next: (results) => {
            this.queryResults.set(results);
            this.loading.set(false);
          },
        });

      onCleanup(() => sub.unsubscribe());
    });
  }

  private applyDashboardContext(
    metricQuery: MetricQuery,
    dashboardFilters: DashboardDimensionFilter[],
    _dateZoomGranularity: DateZoomGranularity,
    timeTravel: TimeTravelConfig | null,
  ): MetricQuery {
    return applyDashboardContextToMetricQuery(
      metricQuery,
      dashboardFilters,
      timeTravel,
    );
  }
}
