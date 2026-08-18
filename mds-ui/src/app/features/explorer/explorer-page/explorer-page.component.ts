import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import { DashboardDimensionFilter } from '../../../core/models/dashboard.model';
import {
  CompiledTable,
  Explore,
  ExploreSummary,
  FieldId,
  QueryResults,
  TimeTravelConfig,
  getFieldId,
} from '../../../core/models/explore.model';
import { ExplorerService } from '../explorer.service';
import {
  CREATE_FROM_EXPLORE_STATE_KEY,
  CreateChartFromExploreState,
} from '../create-chart-from-explore';
import {
  ChartQueryActions,
  ChartQueryEntry,
  ChartQueryKeyInput,
  chartQueryKey,
  selectEntries,
} from '../../../core/store';
import {
  clampQueryLimit,
  DEFAULT_QUERY_LIMIT,
  resolveCsvMaxLimit,
  resolveMaxQueryLimit,
} from '../query-limit.utils';
import { buildMetricQuerySql } from '../metric-query-sql.utils';
import { TablesFiltersPanelComponent } from '../tables-filters-panel/tables-filters-panel.component';
import { getFilterableDimensions } from '../tables-filters-panel/tables-filters.utils';
import { QueryResultsPanelComponent } from '../../charts/query-results-panel/query-results-panel.component';
import { ExportFormat } from '../../export/export.models';
import { ExportService } from '../../export/export.service';
import { startExport } from '../../export/start-export';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { RunQueryButtonComponent } from '../../../shared/run-query-button/run-query-button.component';
import { SqlHighlightComponent } from '../../../shared/sql-highlight/sql-highlight.component';

type TableFieldGroup = {
  table: CompiledTable;
  dimensions: { fieldId: FieldId; label: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

const RESULTS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const RESULTS_DEFAULT_PAGE_SIZE = 25;

@Component({
  selector: 'app-explorer-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    QueryResultsPanelComponent,
    TablesFiltersPanelComponent,
    ResizableSidebarDirective,
    RunQueryButtonComponent,
    SqlHighlightComponent,
  ],
  templateUrl: './explorer-page.component.html',
  styleUrl: './explorer-page.component.scss',
})
export class ExplorerPageComponent {
  private readonly explorerService = inject(ExplorerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(Store);
  private readonly dialog = inject(MatDialog);
  private readonly exportService = inject(ExportService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly appState = inject(AppStateService);
  protected readonly activeProjectService = inject(ActiveProjectService);

  private readonly cacheEntries = toSignal(this.store.select(selectEntries), {
    initialValue: {} as Record<string, ChartQueryEntry>,
  });

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly tableId = signal<string | null>(null);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly explores = signal<ExploreSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedDimensions = signal<Set<FieldId>>(new Set());
  protected readonly selectedMetrics = signal<Set<FieldId>>(new Set());
  protected readonly dimensionFilters = signal<DashboardDimensionFilter[]>([]);
  protected readonly timeTravel = signal<TimeTravelConfig | null>(null);
  protected readonly fieldSearch = signal('');
  protected readonly rowLimit = signal(DEFAULT_QUERY_LIMIT);

  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);

  protected readonly resultsPageSizeOptions = RESULTS_PAGE_SIZE_OPTIONS;
  protected readonly resultsPageIndex = signal(0);
  protected readonly resultsPageSize = signal(RESULTS_DEFAULT_PAGE_SIZE);
  private loadGeneration = 0;

  protected readonly maxQueryLimit = computed(() =>
    resolveMaxQueryLimit(this.appState.health()?.query?.maxLimit),
  );

  protected readonly queryRowLimit = computed(() =>
    clampQueryLimit(this.rowLimit(), this.maxQueryLimit()),
  );

  protected readonly selectedDimensionList = computed(() =>
    Array.from(this.selectedDimensions()),
  );

  protected readonly selectedMetricList = computed(() =>
    Array.from(this.selectedMetrics()),
  );

  protected readonly canRunQuery = computed(
    () =>
      this.selectedDimensionList().length > 0 ||
      this.selectedMetricList().length > 0,
  );

  protected readonly canCreateChart = computed(() => this.canRunQuery());

  protected readonly canExport = computed(() => !!this.queryResults());

  protected readonly tableGroups = computed<TableFieldGroup[]>(() => {
    const explore = this.explore();
    if (!explore) {
      return [];
    }

    return Object.values(explore.tables).map((table) => ({
      table,
      dimensions: Object.values(table.dimensions)
        .filter((dim) => !dim.hidden)
        .map((dim) => ({
          fieldId: getFieldId(table.name, dim.name),
          label: dim.label,
        })),
      metrics: Object.values(table.metrics)
        .filter((metric) => !metric.hidden)
        .map((metric) => ({
          fieldId: getFieldId(table.name, metric.name),
          label: metric.label,
        })),
    }));
  });

  protected readonly filteredTableGroups = computed(() => {
    const query = this.fieldSearch().trim().toLowerCase();
    const groups = this.tableGroups();

    if (!query) {
      return groups;
    }

    return groups
      .map((group) => ({
        ...group,
        dimensions: group.dimensions.filter((field) =>
          field.label.toLowerCase().includes(query),
        ),
        metrics: group.metrics.filter((field) =>
          field.label.toLowerCase().includes(query),
        ),
      }))
      .filter(
        (group) => group.dimensions.length > 0 || group.metrics.length > 0,
      );
  });

  protected readonly filterableDimensions = computed(() => {
    const explore = this.explore();
    if (!explore) {
      return [];
    }
    return getFilterableDimensions(explore);
  });

  protected readonly displayedColumns = computed(() => {
    const results = this.queryResults();
    if (!results) {
      return [];
    }
    return Object.keys(results.fields);
  });

  protected readonly resultRows = computed(() => {
    const results = this.queryResults();
    if (!results) {
      return [];
    }

    return results.rows.map((row) => {
      const flat: Record<string, string> = {};
      for (const [fieldId, cell] of Object.entries(row)) {
        flat[fieldId] = cell.value.formatted;
      }
      return flat;
    });
  });

  protected readonly clampedResultsPageIndex = computed(() => {
    const rows = this.resultRows();
    const pageSize = this.resultsPageSize();
    const maxPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
    return Math.min(this.resultsPageIndex(), maxPage);
  });

  protected readonly compiledSql = computed(
    () => this.queryResults()?.compiledSql?.trim() || null,
  );

  protected readonly generatedSql = computed(() => {
    const explore = this.explore();
    if (!explore) {
      return null;
    }
    return buildMetricQuerySql(
      explore,
      this.selectedDimensionList(),
      this.selectedMetricList(),
      this.queryRowLimit(),
      this.dimensionFilters(),
      this.timeTravel(),
    );
  });

  protected readonly displaySql = computed(
    () => this.compiledSql() ?? this.generatedSql(),
  );

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const tableId = params.get('tableId');

      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.tableId.set(tableId);
      this.activeProjectService.setActiveProject(projectUuid);

      if (!tableId) {
        this.resetWorkspace();
        this.loadExplores(projectUuid);
        return;
      }

      this.loadExplore(projectUuid, tableId);
    });

    effect(() => {
      const input = this.queryCacheInput();
      if (!input) {
        return;
      }

      const entry = this.cacheEntries()[chartQueryKey(input)];
      if (!entry) {
        return;
      }

      if (entry.snapshot?.queryResults) {
        this.queryResults.set(entry.snapshot.queryResults);
        this.resultsPageIndex.set(0);
      }

      if (entry.status === 'loading') {
        this.queryLoading.set(!entry.snapshot?.queryResults);
        this.queryError.set(null);
      } else if (entry.status === 'success') {
        this.queryLoading.set(false);
        this.queryError.set(null);
      } else if (entry.status === 'error') {
        this.queryLoading.set(false);
        this.queryError.set(entry.error ?? 'Failed to run query.');
      }
    });
  }

  private resetWorkspace(): void {
    this.explore.set(null);
    this.error.set(null);
    this.selectedDimensions.set(new Set());
    this.selectedMetrics.set(new Set());
    this.dimensionFilters.set([]);
    this.timeTravel.set(null);
    this.fieldSearch.set('');
    this.queryResults.set(null);
    this.queryError.set(null);
    this.queryLoading.set(false);
    this.resultsPageIndex.set(0);
  }

  private loadExplores(projectUuid: string): void {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set(null);

    this.explorerService.listExplores(projectUuid).subscribe({
      next: (explores) => {
        if (generation !== this.loadGeneration) {
          return;
        }
        this.explores.set(explores);
        this.loading.set(false);
      },
      error: (err) => {
        if (generation !== this.loadGeneration) {
          return;
        }
        this.error.set(apiErrorMessage(err, 'Failed to load explores.'));
        this.loading.set(false);
      },
    });
  }

  private loadExplore(projectUuid: string, tableId: string): void {
    const generation = ++this.loadGeneration;
    this.loading.set(true);
    this.error.set(null);
    this.resetWorkspace();

    this.explorerService.getExplore(projectUuid, tableId).subscribe({
      next: (explore) => {
        if (generation !== this.loadGeneration) {
          return;
        }
        this.explore.set(explore);
        this.loading.set(false);
      },
      error: (err) => {
        if (generation !== this.loadGeneration) {
          return;
        }
        this.error.set(apiErrorMessage(err, 'Failed to load explore.'));
        this.loading.set(false);
      },
    });
  }

  protected openExplore(tableId: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'explore', tableId]);
  }

  protected onFieldSearch(value: string): void {
    this.fieldSearch.set(value);
  }

  protected isDimensionSelected(fieldId: FieldId): boolean {
    return this.selectedDimensions().has(fieldId);
  }

  protected isMetricSelected(fieldId: FieldId): boolean {
    return this.selectedMetrics().has(fieldId);
  }

  protected toggleDimension(fieldId: FieldId): void {
    const next = new Set(this.selectedDimensions());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedDimensions.set(next);
  }

  protected toggleMetric(fieldId: FieldId): void {
    const next = new Set(this.selectedMetrics());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedMetrics.set(next);
  }

  protected onDimensionFiltersChange(filters: DashboardDimensionFilter[]): void {
    this.dimensionFilters.set(filters);
  }

  protected setQueryRowLimit(limit: number): void {
    this.rowLimit.set(clampQueryLimit(limit, this.maxQueryLimit()));
  }

  protected onResultsPage(event: PageEvent): void {
    this.resultsPageIndex.set(event.pageIndex);
    this.resultsPageSize.set(event.pageSize);
  }

  protected getColumnLabel(column: FieldId): string {
    const results = this.queryResults();
    return results?.fields[column]?.label ?? this.getFieldLabel(column);
  }

  protected readonly columnLabelFn = (column: string): string =>
    this.getColumnLabel(column);

  protected readonly isMetricFn = (column: string): boolean =>
    this.isResultColumnMetric(column);

  protected isResultColumnMetric(column: FieldId): boolean {
    const results = this.queryResults();
    if (!results) {
      return false;
    }
    const field = results.fields[column];
    if (field?.fieldType === 'metric') {
      return true;
    }
    if (field?.fieldType === 'dimension') {
      return false;
    }
    return results.metricQuery.metrics.includes(column);
  }

  protected getFieldLabel(fieldId: FieldId): string {
    const explore = this.explore();
    if (!explore) {
      return fieldId;
    }

    for (const table of Object.values(explore.tables)) {
      for (const dim of Object.values(table.dimensions)) {
        if (getFieldId(table.name, dim.name) === fieldId) {
          return dim.label;
        }
      }
      for (const metric of Object.values(table.metrics)) {
        if (getFieldId(table.name, metric.name) === fieldId) {
          return metric.label;
        }
      }
    }

    return fieldId;
  }

  protected runQuery(): void {
    const input = this.queryCacheInput();
    if (!input) {
      this.queryResults.set(null);
      return;
    }

    const cacheKey = chartQueryKey(input);
    const cachedEntry = this.cacheEntries()[cacheKey];
    if (cachedEntry?.status === 'success' && cachedEntry.snapshot?.queryResults) {
      this.queryResults.set(cachedEntry.snapshot.queryResults);
      this.resultsPageIndex.set(0);
      this.queryLoading.set(false);
      this.queryError.set(null);
      return;
    }

    if (cachedEntry?.status === 'loading') {
      this.queryLoading.set(!cachedEntry.snapshot?.queryResults);
      return;
    }

    this.queryLoading.set(!cachedEntry?.snapshot?.queryResults);
    this.queryError.set(null);
    this.store.dispatch(ChartQueryActions.load({ key: cacheKey, input }));
  }

  protected onExportCsv(): void {
    this.startExploreExport('csv');
  }

  protected onExportXlsx(): void {
    this.startExploreExport('xlsx');
  }

  protected createChartFromData(): void {
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    if (!projectUuid || !explore || !this.canCreateChart()) {
      return;
    }

    const state: CreateChartFromExploreState = {
      exploreName: explore.name,
      dimensions: this.selectedDimensionList(),
      metrics: this.selectedMetricList(),
      filters: {},
      sorts: [],
      additionalMetrics: [],
      rowLimit: this.queryRowLimit(),
      timeTravel: this.timeTravel(),
      dimensionFilters: this.dimensionFilters(),
    };

    void this.router.navigate(['/projects', projectUuid, 'charts', 'new'], {
      state: { [CREATE_FROM_EXPLORE_STATE_KEY]: state },
    });
  }

  private startExploreExport(format: ExportFormat): void {
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    const metricQuery = this.queryResults()?.metricQuery;
    if (!projectUuid || !metricQuery) {
      return;
    }

    startExport({
      dialog: this.dialog,
      exportService: this.exportService,
      snackBar: this.snackBar,
      projectUuid,
      metricQuery,
      format,
      csvMaxLimit: resolveCsvMaxLimit(this.appState.health()?.query?.csvMaxLimit),
      filenameBase: explore?.label || explore?.name || 'export',
    });
  }

  private queryCacheInput(): ChartQueryKeyInput | null {
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();

    if (!projectUuid || !explore || (dimensions.length === 0 && metrics.length === 0)) {
      return null;
    }

    return {
      kind: 'metricQuery',
      projectUuid,
      metricQuery: {
        exploreName: explore.name,
        dimensions,
        metrics,
        filters: {},
        sorts: [],
        limit: this.queryRowLimit(),
        tableCalculations: [],
        additionalMetrics: [],
      },
      dimensionFilters: this.dimensionFilters(),
      timeTravel: this.timeTravel(),
    };
  }
}
