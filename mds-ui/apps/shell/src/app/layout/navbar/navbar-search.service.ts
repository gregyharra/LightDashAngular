import { Injectable, inject } from '@angular/core';
import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  shareReplay,
  tap,
} from 'rxjs';
import { SavedChartBasic } from '../../core/models/chart.model';
import { DashboardBasicDetailsWithTileTypes } from '../../core/models/dashboard.model';
import {
  ColumnLineageEdge,
  ColumnTransformationType,
  LineageColumn,
  LineageNode,
} from '../../core/models/lineage.model';
import { ChartService } from '../../features/charts/chart.service';
import { DashboardService } from '../../features/dashboards/dashboard.service';
import { inferColumnTransformation } from '../../features/lineage/column-transformation.utils';
import { columnNamesEqual } from '../../features/lineage/lineage-column-utils';
import { LineageService } from '../../features/lineage/lineage.service';

export type NavbarSearchKind = 'model' | 'column' | 'dashboard' | 'chart';

export type NavbarSearchChip = {
  label: string;
  /** When set, render with `app-transformation-chip` instead of a meta chip. */
  transformationType?: ColumnTransformationType;
};

export type NavbarSearchResult = {
  id: string;
  kind: NavbarSearchKind;
  title: string;
  chips: NavbarSearchChip[];
  /** Free-text description only (metadata lives in chips). */
  subtitle: string;
  icon: string;
  route: string[];
};

export type NavbarSearchGroup = {
  kind: NavbarSearchKind;
  label: string;
  results: NavbarSearchResult[];
};

type SearchIndex = {
  projectUuid: string;
  models: LineageNode[];
  columnEdges: ColumnLineageEdge[];
  dashboards: DashboardBasicDetailsWithTileTypes[];
  charts: SavedChartBasic[];
};

const LIMITS: Record<NavbarSearchKind, number> = {
  model: 6,
  column: 6,
  dashboard: 5,
  chart: 5,
};

const KIND_LABELS: Record<NavbarSearchKind, string> = {
  model: 'Models',
  column: 'Columns',
  dashboard: 'Dashboards',
  chart: 'Charts',
};

@Injectable({ providedIn: 'root' })
export class NavbarSearchService {
  private readonly lineageService = inject(LineageService);
  private readonly dashboardService = inject(DashboardService);
  private readonly chartService = inject(ChartService);

  private indexCache = new Map<string, Observable<SearchIndex>>();

  search(projectUuid: string, rawQuery: string): Observable<NavbarSearchGroup[]> {
    const query = rawQuery.trim().toLowerCase();
    if (!query) {
      return of([]);
    }

    return this.loadIndex(projectUuid).pipe(
      map((index) => this.matchIndex(index, query)),
    );
  }

  clearCache(projectUuid?: string): void {
    if (projectUuid) {
      this.indexCache.delete(projectUuid);
      return;
    }
    this.indexCache.clear();
  }

  private loadIndex(projectUuid: string): Observable<SearchIndex> {
    const cached = this.indexCache.get(projectUuid);
    if (cached) {
      return cached;
    }

    const emptyLineage = {
      nodes: [] as LineageNode[],
      columnEdges: [] as ColumnLineageEdge[],
    };

    const request$ = forkJoin({
      lineage: this.lineageService.getProjectLineage(projectUuid).pipe(
        catchError(() => of(emptyLineage)),
      ),
      dashboards: this.dashboardService.list(projectUuid).pipe(
        catchError(() => of([] as DashboardBasicDetailsWithTileTypes[])),
      ),
      charts: this.chartService.list(projectUuid).pipe(
        catchError(() => of([] as SavedChartBasic[])),
      ),
    }).pipe(
      map(({ lineage, dashboards, charts }) => ({
        projectUuid,
        models: lineage.nodes ?? [],
        columnEdges: lineage.columnEdges ?? [],
        dashboards,
        charts,
      })),
      tap({
        error: () => this.indexCache.delete(projectUuid),
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.indexCache.set(projectUuid, request$);
    return request$;
  }

  private matchIndex(index: SearchIndex, query: string): NavbarSearchGroup[] {
    const projectUuid = index.projectUuid;
    const models: NavbarSearchResult[] = [];
    const columns: NavbarSearchResult[] = [];

    for (const model of index.models) {
      if (models.length < LIMITS.model && this.matchesModel(model, query)) {
        models.push(this.toModelResult(projectUuid, model));
      }

      if (columns.length >= LIMITS.column) {
        continue;
      }

      for (const column of model.columns ?? []) {
        if (columns.length >= LIMITS.column) {
          break;
        }
        if (!this.matchesColumn(column.name, column.type, column.description, column.tags, model.name, query)) {
          continue;
        }
        columns.push(this.toColumnResult(projectUuid, model, column, index.models, index.columnEdges));
      }
    }

    const dashboards = index.dashboards
      .filter((dashboard) => this.matchesDashboard(dashboard, query))
      .slice(0, LIMITS.dashboard)
      .map((dashboard) => this.toDashboardResult(projectUuid, dashboard));

    const charts = index.charts
      .filter((chart) => this.matchesChart(chart, query))
      .slice(0, LIMITS.chart)
      .map((chart) => this.toChartResult(projectUuid, chart));

    return (
      [
        { kind: 'model' as const, label: KIND_LABELS.model, results: models },
        { kind: 'column' as const, label: KIND_LABELS.column, results: columns },
        { kind: 'dashboard' as const, label: KIND_LABELS.dashboard, results: dashboards },
        { kind: 'chart' as const, label: KIND_LABELS.chart, results: charts },
      ] satisfies NavbarSearchGroup[]
    ).filter((group) => group.results.length > 0);
  }

  private matchesModel(model: LineageNode, query: string): boolean {
    return this.includesAny(query, [
      model.name,
      model.type,
      model.schema,
      model.database,
      model.description,
      ...(model.tags ?? []),
    ]);
  }

  private matchesColumn(
    name: string,
    type: string,
    description: string | undefined,
    tags: string[] | undefined,
    modelName: string,
    query: string,
  ): boolean {
    return this.includesAny(query, [name, type, description, modelName, ...(tags ?? [])]);
  }

  private matchesDashboard(
    dashboard: DashboardBasicDetailsWithTileTypes,
    query: string,
  ): boolean {
    return this.includesAny(query, [
      dashboard.name,
      dashboard.description,
      dashboard.spaceName,
    ]);
  }

  private matchesChart(chart: SavedChartBasic, query: string): boolean {
    return this.includesAny(query, [
      chart.name,
      chart.description,
      chart.spaceName,
      chart.tableName,
      chart.chartKind,
    ]);
  }

  private includesAny(query: string, values: Array<string | null | undefined>): boolean {
    return values.some((value) => !!value && value.toLowerCase().includes(query));
  }

  private toModelResult(projectUuid: string, model: LineageNode): NavbarSearchResult {
    return {
      id: `model:${model.id}`,
      kind: 'model',
      title: model.name,
      chips: this.metaChips([model.type, model.schema]),
      subtitle: this.truncate(model.description) ?? '',
      icon: 'table_chart',
      route: ['/projects', projectUuid, 'tables', model.id],
    };
  }

  private toColumnResult(
    projectUuid: string,
    model: LineageNode,
    column: LineageColumn,
    nodes: LineageNode[],
    columnEdges: ColumnLineageEdge[],
  ): NavbarSearchResult {
    const chips = this.metaChips([column.type, model.name]);
    const transformationChip = this.toTransformationChip(model, column, nodes, columnEdges);
    if (transformationChip) {
      chips.push(transformationChip);
    }

    return {
      id: `column:${model.id}:${column.name}`,
      kind: 'column',
      title: column.name,
      chips,
      subtitle: this.truncate(column.description) ?? '',
      icon: 'view_column',
      route: ['/projects', projectUuid, 'tables', model.id],
    };
  }

  private toTransformationChip(
    model: LineageNode,
    column: LineageColumn,
    nodes: LineageNode[],
    columnEdges: ColumnLineageEdge[],
  ): NavbarSearchChip | null {
    const hasExplicitType = !!column.transformationType;
    const hasExpression = !!column.expression?.trim();
    const hasSourceColumn = !!column.sourceColumn?.trim();
    const hasIncomingEdge = columnEdges.some(
      (edge) =>
        edge.targetNodeId === model.id && columnNamesEqual(edge.targetColumn, column.name),
    );

    if (!hasExplicitType && !hasExpression && !hasSourceColumn && !hasIncomingEdge) {
      return null;
    }

    const transformation = inferColumnTransformation(model, column, columnEdges, nodes);
    return {
      label: transformation,
      transformationType: transformation,
    };
  }

  private toDashboardResult(
    projectUuid: string,
    dashboard: DashboardBasicDetailsWithTileTypes,
  ): NavbarSearchResult {
    return {
      id: `dashboard:${dashboard.uuid}`,
      kind: 'dashboard',
      title: dashboard.name,
      chips: this.metaChips([dashboard.spaceName]),
      subtitle: this.truncate(dashboard.description) ?? '',
      icon: 'dashboard',
      route: ['/projects', projectUuid, 'dashboards', dashboard.uuid],
    };
  }

  private toChartResult(projectUuid: string, chart: SavedChartBasic): NavbarSearchResult {
    return {
      id: `chart:${chart.uuid}`,
      kind: 'chart',
      title: chart.name,
      chips: this.metaChips([
        this.formatChartKind(chart.chartKind),
        chart.tableName,
        chart.spaceName,
      ]),
      subtitle: this.truncate(chart.description) ?? '',
      icon: 'bar_chart',
      route: ['/projects', projectUuid, 'charts', chart.uuid],
    };
  }

  private metaChips(values: Array<string | null | undefined>): NavbarSearchChip[] {
    const chips: NavbarSearchChip[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      const label = value?.trim();
      if (!label) {
        continue;
      }
      const key = label.toLowerCase();
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      chips.push({ label });
    }
    return chips;
  }

  private formatChartKind(kind: string): string {
    return kind.replace(/_/g, ' ');
  }

  private truncate(value: string | null | undefined, max = 72): string | undefined {
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
  }
}
