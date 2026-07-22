import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  CompiledTable,
  Explore,
  FieldId,
  QueryResults,
  getFieldId,
} from '../../../core/models/explore.model';
import { ExplorerService } from '../explorer.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

type TableFieldGroup = {
  table: CompiledTable;
  dimensions: { fieldId: FieldId; label: string }[];
  metrics: { fieldId: FieldId; label: string }[];
};

@Component({
  selector: 'app-explorer-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    ResizableSidebarDirective,
  ],
  templateUrl: './explorer-page.component.html',
  styleUrl: './explorer-page.component.scss',
})
export class ExplorerPageComponent {
  private readonly explorerService = inject(ExplorerService);
  private readonly route = inject(ActivatedRoute);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly tableId = signal<string | null>(null);
  protected readonly explore = signal<Explore | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedFields = signal<Set<FieldId>>(new Set());
  protected readonly queryLoading = signal(false);
  protected readonly queryError = signal<string | null>(null);
  protected readonly queryResults = signal<QueryResults | null>(null);
  protected readonly hasRunQuery = signal(false);

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

  protected readonly selectedFieldList = computed(() =>
    Array.from(this.selectedFields()),
  );

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

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const tableId = params.get('tableId');

      if (!projectUuid || !tableId) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.tableId.set(tableId);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadExplore(projectUuid, tableId);
    });
  }

  private loadExplore(projectUuid: string, tableId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.queryResults.set(null);
    this.hasRunQuery.set(false);
    this.queryError.set(null);

    this.explorerService.getExplore(projectUuid, tableId).subscribe({
      next: (explore) => {
        this.explore.set(explore);
        this.loading.set(false);
        this.setDefaultSelection(explore);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Failed to load explore.'));
        this.loading.set(false);
      },
    });
  }

  private setDefaultSelection(explore: Explore): void {
    const defaults = new Set<FieldId>();

    const ordersDims = [
      getFieldId('orders', 'order_id'),
      getFieldId('orders', 'status'),
      getFieldId('orders', 'order_date'),
      getFieldId('customers', 'first_name'),
      getFieldId('orders', 'amount'),
    ];

    for (const fieldId of ordersDims) {
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

  protected isFieldSelected(fieldId: FieldId): boolean {
    return this.selectedFields().has(fieldId);
  }

  protected toggleField(fieldId: FieldId): void {
    const next = new Set(this.selectedFields());
    if (next.has(fieldId)) {
      next.delete(fieldId);
    } else {
      next.add(fieldId);
    }
    this.selectedFields.set(next);
  }

  protected removeField(fieldId: FieldId): void {
    const next = new Set(this.selectedFields());
    next.delete(fieldId);
    this.selectedFields.set(next);
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

  protected getColumnLabel(fieldId: FieldId): string {
    return this.columnLabels()[fieldId] || fieldId;
  }

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
        error: (err) => {
          this.queryError.set(apiErrorMessage(err, 'Failed to run query.'));
          this.queryLoading.set(false);
        },
      });
  }
}
