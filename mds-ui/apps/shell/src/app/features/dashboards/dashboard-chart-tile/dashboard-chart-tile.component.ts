import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  BigNumberComparison,
  ChartConfig,
  defaultConfigForType,
} from '../../../core/models/chart.model';
import {
  DashboardDimensionFilter,
  DateZoomGranularity,
} from '../../../core/models/dashboard.model';
import { QueryResults, TimeTravelConfig } from '../../../core/models/explore.model';
import {
  ChartQueryActions,
  ChartQueryEntry,
  ChartQuerySnapshot,
  chartQueryKey,
  selectEntries,
} from '../../../core/store';
import { ChartVisualizationComponent } from '../../charts/chart-visualization/chart-visualization.component';

@Component({
  selector: 'app-dashboard-chart-tile',
  imports: [
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    ChartVisualizationComponent,
  ],
  templateUrl: './dashboard-chart-tile.component.html',
  styleUrl: './dashboard-chart-tile.component.scss',
})
export class DashboardChartTileComponent {
  private readonly store = inject(Store);
  private readonly translate = inject(TranslateService);

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

  private lastSeenRefreshToken: number | null = null;

  private readonly cacheEntries = toSignal(this.store.select(selectEntries), {
    initialValue: {} as Record<string, ChartQueryEntry>,
  });

  private readonly cacheKeyInput = computed(() => {
    const savedChartUuid = this.savedChartUuid();
    if (!savedChartUuid) {
      return null;
    }

    return {
      kind: 'dashboardChart' as const,
      projectUuid: this.projectUuid(),
      savedChartUuid,
      dashboardFilters: this.dashboardFilters(),
      dateZoomGranularity: this.dateZoomGranularity(),
      timeTravel: this.timeTravel(),
    };
  });

  private readonly cacheKey = computed(() => {
    const input = this.cacheKeyInput();
    return input ? chartQueryKey(input) : null;
  });

  private readonly cachedEntry = computed(() => {
    const key = this.cacheKey();
    if (!key) {
      return null;
    }
    return this.cacheEntries()[key] ?? null;
  });

  protected readonly displayResults = computed(
    () => this.queryResults() ?? this.cachedEntry()?.snapshot?.queryResults ?? null,
  );
  protected readonly displayConfig = computed(() => {
    if (this.queryResults()) {
      return this.chartConfig();
    }
    return this.cachedEntry()?.snapshot?.chartConfig ?? this.chartConfig();
  });
  protected readonly displayComparison = computed(() => {
    if (this.queryResults()) {
      return this.bigNumberComparison();
    }
    return (
      this.cachedEntry()?.snapshot?.bigNumberComparison ?? this.bigNumberComparison()
    );
  });

  constructor() {
    effect(() => {
      const savedChartUuid = this.savedChartUuid();
      const refreshToken = this.refreshToken();
      const cacheKeyInput = this.cacheKeyInput();
      const cacheKey = this.cacheKey();
      const entry = this.cachedEntry();

      const bypassCache =
        this.lastSeenRefreshToken !== null &&
        refreshToken !== this.lastSeenRefreshToken;
      this.lastSeenRefreshToken = refreshToken;

      if (!savedChartUuid || !cacheKeyInput || !cacheKey) {
        this.loading.set(false);
        this.error.set(null);
        this.queryResults.set(null);
        return;
      }

      if (bypassCache) {
        this.store.dispatch(ChartQueryActions.invalidate({ key: cacheKey }));
        this.queryResults.set(null);
      } else if (entry?.snapshot) {
        this.applySnapshot(entry.snapshot);
      }

      if (entry?.status === 'success' && entry.snapshot && !bypassCache) {
        this.loading.set(false);
        this.error.set(null);
        return;
      }

      if (entry?.status === 'error') {
        this.loading.set(false);
        this.error.set(
          entry.error ?? this.translate.instant('charts.workspace.loadChartError'),
        );
        return;
      }

      if (entry?.status === 'loading') {
        this.loading.set(!this.displayResults());
        this.error.set(null);
        return;
      }

      this.loading.set(!this.displayResults());
      this.error.set(null);
      this.store.dispatch(
        ChartQueryActions.load({
          key: cacheKey,
          input: {
            ...cacheKeyInput,
            bypassCache,
          },
        }),
      );
    });

    effect(() => {
      const entry = this.cachedEntry();
      const cacheKey = this.cacheKey();
      if (!cacheKey || !entry) {
        return;
      }

      if (entry.status === 'success' && entry.snapshot) {
        this.applySnapshot(entry.snapshot);
        this.loading.set(false);
        this.error.set(null);
      } else if (entry.status === 'error') {
        this.loading.set(false);
        this.error.set(
          entry.error ?? this.translate.instant('charts.workspace.loadChartError'),
        );
      } else if (entry.status === 'loading') {
        this.loading.set(!this.displayResults());
      }
    });
  }

  private applySnapshot(snapshot: ChartQuerySnapshot): void {
    if (snapshot.chartConfig) {
      this.chartConfig.set(snapshot.chartConfig);
    }
    this.queryResults.set(snapshot.queryResults);
    this.bigNumberComparison.set(snapshot.bigNumberComparison ?? null);
  }
}
