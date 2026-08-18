import { inject, Injectable } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { apiErrorMessage } from '../../api/lightdash-api.service';
import {
  BigNumberComparison,
  defaultConfigForType,
  normalizeChartConfig,
} from '../../models/chart.model';
import { applyChartPanelPatch } from '../../models/chart-config.utils';
import { FieldId, MetricQuery, QueryResults } from '../../models/explore.model';
import {
  MOCK_CHART_4_UUID,
  MOCK_CHART_5_UUID,
  MOCK_CHART_6_UUID,
} from '../../mock/fixtures/ids.fixture';
import { ChartService } from '../../../features/charts/chart.service';
import { ExplorerService } from '../../../features/explorer/explorer.service';
import {
  applyDashboardContextToMetricQuery,
  mergeDashboardFiltersIntoMetricQuery,
} from '../../../features/dashboards/dashboard-filters';
import { mergeTimeTravelIntoMetricQuery } from '../../../features/explorer/time-travel.utils';
import {
  ChartQueryKeyInput,
  ChartQuerySnapshot,
  DashboardChartCacheInput,
  MetricQueryCacheInput,
  SavedChartViewCacheInput,
} from './chart-query.models';

@Injectable({ providedIn: 'root' })
export class ChartQueryLoader {
  private readonly chartService = inject(ChartService);
  private readonly explorerService = inject(ExplorerService);

  load(input: ChartQueryKeyInput): Observable<ChartQuerySnapshot> {
    switch (input.kind) {
      case 'dashboardChart':
        return this.loadDashboardChart(input);
      case 'savedChartView':
        return this.loadSavedChartView(input);
      case 'metricQuery':
        return this.loadMetricQuery(input);
    }
  }

  private loadDashboardChart(
    input: DashboardChartCacheInput,
  ): Observable<ChartQuerySnapshot> {
    const bypassCache = input.bypassCache ?? false;

    return this.chartService.get(input.projectUuid, input.savedChartUuid).pipe(
      switchMap((chart) => {
        const chartConfig = this.normalizeDashboardChartConfig(
          chart.chartConfig,
          chart.metricQuery,
        );
        const bigNumberComparison = getBigNumberComparison(input.savedChartUuid);

        return this.explorerService
          .getExplore(input.projectUuid, chart.tableName)
          .pipe(
            switchMap((explore) => {
              const metricQuery = applyDashboardContextToMetricQuery(
                chart.metricQuery,
                input.dashboardFilters,
                input.timeTravel,
                explore,
              );

              return this.explorerService
                .runQuery(input.projectUuid, metricQuery, { bypassCache })
                .pipe(
                  switchMap((results) => {
                    const yField = resolvePrimaryYField(chartConfig);
                    const queryResults = applyDemoKpiOverrides(
                      input.savedChartUuid,
                      results,
                      yField,
                    );

                    return [
                      {
                        chartConfig,
                        queryResults,
                        bigNumberComparison,
                      } satisfies ChartQuerySnapshot,
                    ];
                  }),
                );
            }),
          );
      }),
    );
  }

  private loadSavedChartView(
    input: SavedChartViewCacheInput,
  ): Observable<ChartQuerySnapshot> {
    const bypassCache = input.bypassCache ?? false;

    return this.chartService.get(input.projectUuid, input.savedChartUuid).pipe(
      switchMap((chart) => {
        const chartConfig = this.normalizeDashboardChartConfig(
          chart.chartConfig,
          chart.metricQuery,
        );

        return this.explorerService
          .getExplore(input.projectUuid, chart.tableName)
          .pipe(
            switchMap((explore) => {
              const metricQuery = mergeDashboardFiltersIntoMetricQuery(
                chart.metricQuery,
                input.dimensionFilters,
                explore,
              );

              return this.explorerService.runQuery(
                input.projectUuid,
                metricQuery,
                { bypassCache },
              );
            }),
            switchMap((queryResults) => [{ chartConfig, queryResults }]),
          );
      }),
    );
  }

  private loadMetricQuery(
    input: MetricQueryCacheInput,
  ): Observable<ChartQuerySnapshot> {
    const bypassCache = input.bypassCache ?? false;

    return this.explorerService
      .getExplore(input.projectUuid, input.metricQuery.exploreName)
      .pipe(
        switchMap((explore) => {
          const metricQuery = mergeTimeTravelIntoMetricQuery(
            mergeDashboardFiltersIntoMetricQuery(
              input.metricQuery,
              input.dimensionFilters,
              explore,
            ),
            input.timeTravel,
          );

          return this.explorerService.runQuery(input.projectUuid, metricQuery, {
            bypassCache,
          });
        }),
        switchMap((queryResults) => [{ queryResults }]),
      );
  }

  private normalizeDashboardChartConfig(
    rawConfig: ChartQuerySnapshot['chartConfig'],
    metricQuery: MetricQuery,
  ) {
    let config = normalizeChartConfig(rawConfig ?? defaultConfigForType('cartesian'));

    if (config.type === 'cartesian') {
      config = applyChartPanelPatch(config, {
        showLegend: false,
        showValueLabels: true,
        margins: { top: 16, right: 12, bottom: 8, left: 8 },
        xField:
          config.config.layout.xField ?? metricQuery.dimensions[0] ?? null,
        yFields:
          config.config.layout.yFields?.length
            ? config.config.layout.yFields
            : metricQuery.metrics[0]
              ? [metricQuery.metrics[0]]
              : [],
      });
    } else if (config.type === 'pie') {
      config = applyChartPanelPatch(config, {
        showLegend: false,
        margins: { top: 16, right: 12, bottom: 8, left: 8 },
        xField: config.config.xField ?? metricQuery.dimensions[0] ?? null,
        yFields: config.config.yField
          ? [config.config.yField]
          : metricQuery.metrics[0]
            ? [metricQuery.metrics[0]]
            : [],
      });
    } else if (config.type === 'big_number') {
      config = applyChartPanelPatch(config, {
        yFields: config.config.selectedField
          ? [config.config.selectedField]
          : metricQuery.metrics[0]
            ? [metricQuery.metrics[0]]
            : [],
      });
    }

    return config;
  }
}

export function chartQueryErrorMessage(error: unknown): string {
  return apiErrorMessage(error, 'Failed to load chart data.');
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

function resolvePrimaryYField(
  config: NonNullable<ChartQuerySnapshot['chartConfig']>,
): FieldId | null {
  if (config.type === 'big_number') {
    return config.config.selectedField ?? null;
  }
  if (config.type === 'cartesian') {
    return config.config.layout.yFields?.[0] ?? null;
  }
  if (config.type === 'pie') {
    return config.config.yField ?? null;
  }
  return null;
}
