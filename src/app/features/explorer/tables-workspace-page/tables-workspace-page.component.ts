import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { DbtTreeNode } from '../../../core/models/lineage.model';
import { ChartKind } from '../../../core/models/chart.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import {
  CompiledTable,
  Explore,
  ExploreSummary,
  FieldId,
  QueryResults,
  getFieldId,
} from '../../../core/models/explore.model';
import { FolderSearchPanelComponent } from '../../lineage/folder-search-panel/folder-search-panel.component';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { TablesFieldsPanelComponent } from '../tables-fields-panel/tables-fields-panel.component';
import { ChartVisualizationComponent } from '../../charts/chart-visualization/chart-visualization.component';
import { TablesChartConfigPanelComponent } from '../tables-chart-config-panel/tables-chart-config-panel.component';
import {
  DEFAULT_CHART_DISPLAY_CONFIG,
  TablesChartDisplayConfig,
} from '../tables-chart-config-panel/tables-chart-config.constants';
import { buildExploreTree } from '../explore-tree.utils';
import { buildMetricQuerySql } from '../metric-query-sql.utils';
import { ExplorerService } from '../explorer.service';

type TableFieldGroup = {
  table: CompiledTable;
  dimensions: { fieldId: FieldId; label: string; type: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

@Component({
  selector: 'app-tables-workspace-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    FolderSearchPanelComponent,
    TablesFieldsPanelComponent,
    TablesChartConfigPanelComponent,
    ChartVisualizationComponent,
    ResizableSidebarDirective,
  ],
  templateUrl: './tables-workspace-page.component.html',
  styleUrl: './tables-workspace-page.component.scss',
})
export class TablesWorkspacePageComponent {
  private readonly explorerService = inject(ExplorerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly tableId = signal<string | null>(null);
  protected readonly explores = signal<ExploreSummary[]>([]);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly listLoading = signal(true);
  protected readonly exploreLoading = signal(false);
  protected readonly listError = signal<string | null>(null);
  protected readonly exploreError = signal<string | null>(null);

  protected readonly fieldSearch = signal('');
  protected readonly selectedFields = signal<Set<FieldId>>(new Set());
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly hasRunQuery = signal(false);
  protected readonly chartKind = signal<ChartKind>('vertical_bar');
  protected readonly chartXField = signal<FieldId | null>(null);
  protected readonly chartYFields = signal<FieldId[]>([]);
  protected readonly chartDisplayConfig = signal<TablesChartDisplayConfig>(
    DEFAULT_CHART_DISPLAY_CONFIG,
  );
  protected readonly chartConfigOpen = signal(false);

  protected readonly exploreTree = computed<DbtTreeNode[]>(() =>
    buildExploreTree(this.explores()),
  );

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
          type: dim.type,
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

  protected readonly selectedFieldList = computed(() =>
    Array.from(this.selectedFields()),
  );

  protected readonly selectedDimensionList = computed(() =>
    this.selectedFieldList().filter((fieldId) => !this.isMetricField(fieldId)),
  );

  protected readonly selectedMetricList = computed(() =>
    this.selectedFieldList().filter((fieldId) => this.isMetricField(fieldId)),
  );

  protected readonly canRenderChart = computed(() => {
    const results = this.queryResults();
    if (!results || results.rows.length === 0) {
      return false;
    }

    const kind = this.chartKind();
    if (kind === 'table') {
      return true;
    }

    if (kind === 'big_number') {
      return this.chartYFields().length > 0;
    }

    return !!(this.chartXField() && this.chartYFields().length > 0);
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

  protected readonly columnLabels = computed(() => {
    const results = this.queryResults();
    if (!results) {
      return {} as Record<FieldId, string>;
    }

    const labels: Record<FieldId, string> = {};
    for (const [fieldId, field] of Object.entries(results.fields)) {
      labels[fieldId] = field.label;
    }
    return labels;
  });

  protected readonly generatedSql = computed(() => {
    const explore = this.explore();
    if (!explore) {
      return null;
    }

    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();

    if (dimensions.length === 0 && metrics.length === 0) {
      return null;
    }

    return buildMetricQuerySql(explore, dimensions, metrics, 500);
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const tableId = params.get('tableId') ?? null;

      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.tableId.set(tableId);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadExplores(projectUuid);

      if (tableId) {
        this.loadExplore(projectUuid, tableId);
      } else {
        this.explore.set(null);
        this.exploreLoading.set(false);
        this.exploreError.set(null);
        this.resetQueryState();
      }
    });
  }

  private loadExplores(projectUuid: string): void {
    this.listLoading.set(true);
    this.listError.set(null);

    this.explorerService.listExplores(projectUuid).subscribe({
      next: (explores) => {
        this.explores.set(
          [...explores].sort((left, right) =>
            left.label.localeCompare(right.label),
          ),
        );
        this.listLoading.set(false);
      },
      error: () => {
        this.listError.set('Failed to load tables.');
        this.listLoading.set(false);
      },
    });
  }

  private loadExplore(projectUuid: string, tableId: string): void {
    this.exploreLoading.set(true);
    this.exploreError.set(null);
    this.resetQueryState();

    this.explorerService.getExplore(projectUuid, tableId).subscribe({
      next: (explore) => {
        this.explore.set(explore);
        this.exploreLoading.set(false);
        this.setDefaultSelection(explore);
      },
      error: () => {
        this.exploreError.set('Failed to load table.');
        this.exploreLoading.set(false);
      },
    });
  }

  private resetQueryState(): void {
    this.selectedFields.set(new Set());
    this.queryResults.set(null);
    this.queryError.set(null);
    this.hasRunQuery.set(false);
    this.fieldSearch.set('');
    this.chartKind.set('vertical_bar');
    this.chartXField.set(null);
    this.chartYFields.set([]);
    this.chartDisplayConfig.set(DEFAULT_CHART_DISPLAY_CONFIG);
    this.chartConfigOpen.set(false);
  }

  private setDefaultSelection(explore: Explore): void {
    const defaults = new Set<FieldId>();

    const ordersDims = [
      getFieldId('orders', 'order_id'),
      getFieldId('orders', 'status'),
      getFieldId('orders', 'order_date'),
      getFieldId('customers', 'first_name'),
    ];
    const ordersMetrics = [getFieldId('orders', 'order_count')];

    for (const fieldId of [...ordersDims, ...ordersMetrics]) {
      if (this.fieldExistsInExplore(explore, fieldId)) {
        defaults.add(fieldId);
      }
    }

    if (defaults.size === 0) {
      const firstTable = Object.values(explore.tables)[0];
      if (firstTable) {
        const firstDim = Object.values(firstTable.dimensions)[0];
        if (firstDim) {
          defaults.add(getFieldId(firstTable.name, firstDim.name));
        }
      }
    }

    this.selectedFields.set(defaults);
    this.syncChartAxisFields();
  }

  private fieldExistsInExplore(explore: Explore, fieldId: FieldId): boolean {
    for (const table of Object.values(explore.tables)) {
      for (const dim of Object.values(table.dimensions)) {
        if (getFieldId(table.name, dim.name) === fieldId) {
          return true;
        }
      }
      for (const metric of Object.values(table.metrics)) {
        if (getFieldId(table.name, metric.name) === fieldId) {
          return true;
        }
      }
    }
    return false;
  }

  protected onFieldSearch(value: string): void {
    this.fieldSearch.set(value);
  }

  protected onTableSelected(tableName: string): void {
    this.selectTable(tableName);
  }

  protected selectTable(tableName: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }

    void this.router.navigate(['/projects', projectUuid, 'tables', tableName]);
  }

  protected toggleField(fieldId: FieldId): void {
    const next = new Set(this.selectedFields());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedFields.set(next);
    this.syncChartAxisFields();
  }

  protected setChartKind(kind: ChartKind): void {
    this.chartKind.set(kind);
    if (kind === 'horizontal_bar') {
      this.chartDisplayConfig.update((config) => ({ ...config, flipAxes: true }));
    } else if (kind === 'vertical_bar') {
      this.chartDisplayConfig.update((config) => ({ ...config, flipAxes: false }));
    }
  }

  protected setChartXField(fieldId: FieldId): void {
    this.chartXField.set(fieldId);
  }

  protected setChartYFields(fieldIds: FieldId[]): void {
    this.chartYFields.set(fieldIds);
  }

  protected setChartDisplayConfig(config: TablesChartDisplayConfig): void {
    this.chartDisplayConfig.set(config);
    if (config.flipAxes && this.chartKind() === 'vertical_bar') {
      this.chartKind.set('horizontal_bar');
    } else if (!config.flipAxes && this.chartKind() === 'horizontal_bar') {
      this.chartKind.set('vertical_bar');
    }
  }

  protected toggleChartConfig(event: Event): void {
    event.stopPropagation();
    this.chartConfigOpen.update((open) => !open);
  }

  private syncChartAxisFields(): void {
    const dimensions = this.selectedDimensionList();
    const metrics = this.selectedMetricList();
    const currentX = this.chartXField();
    const currentY = this.chartYFields();

    if (!currentX || !dimensions.includes(currentX)) {
      this.chartXField.set(dimensions[0] ?? null);
    }

    const validY = currentY.filter((fieldId) => metrics.includes(fieldId));
    if (validY.length === 0) {
      this.chartYFields.set(metrics[0] ? [metrics[0]] : []);
    } else {
      this.chartYFields.set(validY);
    }
  }

  protected isMetricField(fieldId: FieldId): boolean {
    const explore = this.explore();
    if (!explore) {
      return false;
    }

    for (const table of Object.values(explore.tables)) {
      for (const metric of Object.values(table.metrics)) {
        if (getFieldId(table.name, metric.name) === fieldId) {
          return true;
        }
      }
    }
    return false;
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

  protected getColumnLabel(fieldId: FieldId): string {
    return this.columnLabels()[fieldId] || fieldId;
  }

  protected readonly getFieldLabelFn = (fieldId: FieldId): string =>
    this.getFieldLabel(fieldId);

  protected runQuery(): void {
    const projectUuid = this.projectUuid();
    const explore = this.explore();
    const selected = this.selectedFieldList();

    if (!projectUuid || !explore || selected.length === 0) {
      return;
    }

    const dimensions = selected.filter((id) => !this.isMetricField(id));
    const metrics = selected.filter((id) => this.isMetricField(id));

    this.queryLoading.set(true);
    this.queryError.set(null);
    this.hasRunQuery.set(true);

    this.explorerService
      .runQuery(projectUuid, {
        exploreName: explore.name,
        dimensions,
        metrics,
        filters: {},
        sorts: [],
        limit: 500,
        tableCalculations: [],
        additionalMetrics: [],
      })
      .subscribe({
        next: (results) => {
          this.queryResults.set(results);
          this.queryLoading.set(false);
        },
        error: () => {
          this.queryError.set('Failed to run query.');
          this.queryLoading.set(false);
        },
      });
  }
}
