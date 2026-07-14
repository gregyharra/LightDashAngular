import { Component, effect, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { ChartKind } from '../../../core/models/chart.model';
import { FieldId, QueryResults } from '../../../core/models/explore.model';
import { ChartService } from '../../charts/chart.service';
import { ChartVisualizationComponent } from '../../charts/chart-visualization/chart-visualization.component';
import { ExplorerService } from '../../explorer/explorer.service';

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
            return this.explorerService.runQuery(projectUuid, chart.metricQuery);
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
}
