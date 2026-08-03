import { Component, effect, inject, input, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EMPTY, catchError, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  BigNumberComparison,
  ChartConfig,
  defaultConfigForType,
  normalizeChartConfig,
} from '../../../core/models/chart.model';
import { applyChartPanelPatch } from '../../../core/models/chart-config.utils';
import {
  DashboardDimensionFilter,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import {
  Explore,
  FieldId,
  MetricQuery,
  QueryResults,
  TimeTravelConfig,
} from '../../../core/models/explore.model';
import { ChartService } from '../../charts/chart.service';
import { ChartVisualizationComponent } from '../../charts/chart-visualization/chart-visualization.component';
import { ExplorerService } from '../../explorer/explorer.service';
import { applyDashboardContextToMetricQuery } from '../dashboard-filters';
import {
  MOCK_CHART_4_UUID,
  MOCK_CHART_5_UUID,
  MOCK_CHART_6_UUID,
} from '../../../core/mock/fixtures/ids.fixture';

@Component({
  selector: 'app-dashboard-chart-tile',
  imports: [
    MatIconModule,
    MatProgressSpinnerModule,
    ChartVisualizationComponent,
  ],
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
  readonly refreshToken = input(0);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly chartConfig = signal<ChartConfig>(
    defaultConfigForType('cartesian'),
  );
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly bigNumberComparison = signal<BigNumberComparison | null>(
    null,
  );

  constructor() {
    effect((onCleanup) => {
      const projectUuid = this.projectUuid();
      const savedChartUuid = this.savedChartUuid();
      const dashboardFilters = this.dashboardFilters();
      const dateZoomGranularity = this.dateZoomGranularity();
      const timeTravel = this.timeTravel();
      void this.refreshToken();

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
            let config = normalizeChartConfig(chart.chartConfig);
            if (config.type === 'cartesian') {
              config = applyChartPanelPatch(config, {
                showLegend: false,
                showValueLabels: true,
                margins: { top: 16, right: 12, bottom: 8, left: 8 },
                xField:
                  config.config.layout.xField ??
                  chart.metricQuery.dimensions[0] ??
                  null,
                yFields:
                  config.config.layout.yFields?.length
                    ? config.config.layout.yFields
                    : chart.metricQuery.metrics[0]
                      ? [chart.metricQuery.metrics[0]]
                      : [],
              });
            } else if (config.type === 'pie') {
              config = applyChartPanelPatch(config, {
                showLegend: false,
                margins: { top: 16, right: 12, bottom: 8, left: 8 },
                xField:
                  config.config.xField ??
                  chart.metricQuery.dimensions[0] ??
                  null,
                yFields: config.config.yField
                  ? [config.config.yField]
                  : chart.metricQuery.metrics[0]
                    ? [chart.metricQuery.metrics[0]]
                    : [],
              });
            } else if (config.type === 'big_number') {
              config = applyChartPanelPatch(config, {
                yFields: config.config.selectedField
                  ? [config.config.selectedField]
                  : chart.metricQuery.metrics[0]
                    ? [chart.metricQuery.metrics[0]]
                    : [],
              });
            }
            this.chartConfig.set(config);
            this.bigNumberComparison.set(
              getBigNumberComparison(savedChartUuid),
            );

            return this.explorerService
              .getExplore(projectUuid, chart.tableName)
              .pipe(
                switchMap((explore) => {
                  const metricQuery = this.applyDashboardContext(
                    chart.metricQuery,
                    dashboardFilters,
                    dateZoomGranularity,
                    timeTravel,
                    explore,
                  );
                  return this.explorerService.runQuery(
                    projectUuid,
                    metricQuery,
                  );
                }),
              );
          }),
          catchError((err) => {
            this.error.set(apiErrorMessage(err, 'Failed to load chart.'));
            this.loading.set(false);
            return EMPTY;
          }),
        )
        .subscribe({
          next: (results) => {
            const cfg = this.chartConfig();
            const yField =
              cfg.type === 'big_number'
                ? (cfg.config.selectedField ?? null)
                : cfg.type === 'cartesian'
                  ? (cfg.config.layout.yFields?.[0] ?? null)
                  : cfg.type === 'pie'
                    ? (cfg.config.yField ?? null)
                    : null;
            this.queryResults.set(
              applyDemoKpiOverrides(savedChartUuid, results, yField),
            );
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
    explore: Explore,
  ): MetricQuery {
    return applyDashboardContextToMetricQuery(
      metricQuery,
      dashboardFilters,
      timeTravel,
      explore,
    );
  }
}

const BIG_NUMBER_COMPARISONS: Record<string, BigNumberComparison> = {
  [MOCK_CHART_4_UUID]: {
    label: '+10% ↗ MoM',
    direction: 'up',
  },
  [MOCK_CHART_5_UUID]: {
    label: '+5.75K ↗ MoM',
    direction: 'up',
  },
};

function getBigNumberComparison(
  savedChartUuid: string,
): BigNumberComparison | null {
  return BIG_NUMBER_COMPARISONS[savedChartUuid] ?? null;
}

const DEMO_KPI_VALUES: Record<string, { formatted: string; label?: string }> = {
  [MOCK_CHART_4_UUID]: { formatted: '8,616', label: 'Orders fulfilled' },
  [MOCK_CHART_5_UUID]: { formatted: '124.15K', label: 'Total Revenue' },
  [MOCK_CHART_6_UUID]: { formatted: '$1,097,095', label: 'Total profit' },
};

function applyDemoKpiOverrides(
  savedChartUuid: string,
  results: QueryResults,
  yField: FieldId | null,
): QueryResults {
  const override = DEMO_KPI_VALUES[savedChartUuid];
  if (!override || !yField || results.rows.length === 0) {
    return results;
  }

  const row = { ...results.rows[0] };
  row[yField] = {
    value: {
      raw: row[yField]?.value.raw ?? 0,
      formatted: override.formatted,
    },
  };

  const fields = { ...results.fields };
  if (override.label && fields[yField]) {
    fields[yField] = { ...fields[yField], label: override.label };
  }

  return { ...results, rows: [row], fields };
}
