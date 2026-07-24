import { ENTER } from '@angular/cdk/keycodes';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Observable, forkJoin, of } from 'rxjs';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { apiErrorMessage } from '../../../core/api/lightdash-api.service';
import {
  CUSTOM_ATTRIBUTE_DEFS_KEY,
  CustomAttributeDef,
  CustomAttributeType,
  DictionaryColumn,
  DictionaryEntry,
  DictionaryQuality,
} from '../../../core/models/dictionary.model';
import {
  AddAttributeDialogComponent,
  AddAttributeDialogResult,
} from './add-attribute-dialog/add-attribute-dialog.component';
import {
  LineageGraphMode,
  LineageHopDepth,
  LineageViewMode,
  ProjectLineage,
  DbtTreeNode,
  SelectedColumnRef,
} from '../../../core/models/lineage.model';
import { FolderSearchPanelComponent } from '../../lineage/folder-search-panel/folder-search-panel.component';
import { LineageGraphComponent } from '../../lineage/lineage-graph/lineage-graph.component';
import { LineageService } from '../../lineage/lineage.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { DictionaryService } from '../dictionary.service';
import { SqlHighlightComponent } from '../../../shared/sql-highlight/sql-highlight.component';
import {
  ModelSqlViewMode,
  preferredModelSqlViewMode,
  resolveModelSqlDisplay,
} from '../../../shared/sql-highlight/model-sql-view';
import {
  ColumnFilterType,
  ColumnFilterValue,
  ContentListColumnHeaderComponent,
} from '../../../ui/content-list-column-header/content-list-column-header.component';
import {
  NumberFilterValue,
  SelectFilterValue,
  SelectOption,
  TextFilterValue,
  collectUniqueValues,
  emptyNumberFilter,
  emptySelectFilter,
  emptyTextFilter,
  isNumberFilterActive,
  matchesNumberFilter,
  matchesSelectFilter,
  matchesTextFilter,
} from '../../../ui/content-list-filter.utils';

type HubTab = 'overview' | 'columns' | 'lineage' | 'sql';

type AttributeFilterValue = TextFilterValue | SelectFilterValue | NumberFilterValue;

type ColumnsTableFilters = {
  name: TextFilterValue;
  type: SelectFilterValue;
  description: TextFilterValue;
  attributes: Record<string, AttributeFilterValue>;
};

const BOOLEAN_ATTRIBUTE_FILTER_OPTIONS: SelectOption[] = [
  { value: 'true', label: 'true' },
  { value: 'false', label: 'false' },
  { value: '', label: 'Unset' },
];

function createEmptyColumnsTableFilters(): ColumnsTableFilters {
  return {
    name: emptyTextFilter(),
    type: emptySelectFilter(),
    description: emptyTextFilter(),
    attributes: {},
  };
}

/**
 * Tag adding/removal in the Table Hub is not used for now. Existing tags are
 * always shown (read-only). Flip this to `true` to re-enable interactive tag
 * editing (add-tag input and per-chip remove buttons) in the overview tab
 * without removing any of the underlying code.
 */
const ENABLE_TABLE_HUB_TAG_EDITING = false;

@Component({
  selector: 'app-table-hub-page',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AddAttributeDialogComponent,
    ContentListColumnHeaderComponent,
    FolderSearchPanelComponent,
    LineageGraphComponent,
    ResizableSidebarDirective,
    SqlHighlightComponent,
  ],
  templateUrl: './table-hub-page.component.html',
  styleUrl: './table-hub-page.component.scss',
})
export class TableHubPageComponent {
  protected readonly enableTagEditing = ENABLE_TABLE_HUB_TAG_EDITING;

  private readonly dictionaryService = inject(DictionaryService);
  private readonly lineageService = inject(LineageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly tableId = signal<string | null>(null);
  protected readonly dbtTree = signal<DbtTreeNode[]>([]);
  protected readonly lineage = signal<ProjectLineage | null>(null);
  protected readonly entry = signal<DictionaryEntry | null>(null);
  protected readonly quality = signal<DictionaryQuality | null>(null);
  protected readonly loading = signal(true);
  protected readonly entryLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly entryError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<HubTab>('overview');
  protected readonly sqlViewMode = signal<ModelSqlViewMode>('compiled');
  protected readonly lineageViewMode = signal<LineageViewMode>('models');
  protected readonly lineageGraphMode = signal<LineageGraphMode>('focus');
  protected readonly lineageHopDepth = signal<LineageHopDepth>(0);
  protected readonly selectedColumn = signal<SelectedColumnRef | null>(null);
  protected readonly showAddAttribute = signal(false);
  protected readonly columnFilters = signal<ColumnsTableFilters>(createEmptyColumnsTableFilters());

  protected readonly descriptionDraft = signal('');
  protected readonly tagsDraft = signal<string[]>([]);
  protected readonly tagSeparatorKeys = [ENTER] as const;

  protected readonly selectedNode = computed(() => {
    const id = this.tableId();
    const lineage = this.lineage();
    if (!id || !lineage) {
      return null;
    }
    return lineage.nodes.find((node) => node.id === id || node.name === id) ?? null;
  });

  protected readonly hasCompiledSql = computed(
    () => !!this.entry()?.compiledSql?.trim(),
  );
  protected readonly hasUncompiledSql = computed(() => !!this.entry()?.sql?.trim());
  protected readonly hasAnySql = computed(
    () => this.hasCompiledSql() || this.hasUncompiledSql(),
  );
  protected readonly displaySql = computed(() => {
    const entry = this.entry();
    if (!entry) {
      return null;
    }
    return resolveModelSqlDisplay(entry.sql, entry.compiledSql, this.sqlViewMode());
  });
  protected readonly showCompiledUnavailableHint = computed(
    () => !this.hasCompiledSql() && this.hasUncompiledSql(),
  );

  protected readonly attributeDefs = computed<CustomAttributeDef[]>(() => {
    const raw = this.entry()?.custom?.[CUSTOM_ATTRIBUTE_DEFS_KEY];
    return Array.isArray(raw) ? (raw as CustomAttributeDef[]) : [];
  });

  protected readonly existingAttributeNames = computed(() =>
    this.attributeDefs().map((def) => def.name),
  );

  protected readonly columnTypeOptions = computed<SelectOption[]>(() => {
    const columns = this.entry()?.columns ?? [];
    return collectUniqueValues(columns, (column) => column.type).map((type) => ({
      value: type,
      label: type,
    }));
  });

  protected readonly filteredColumns = computed(() => {
    const columns = this.entry()?.columns ?? [];
    const filters = this.columnFilters();
    const attrs = this.attributeDefs();

    return columns.filter((column) => {
      if (!matchesTextFilter(column.name, filters.name)) {
        return false;
      }
      if (!matchesSelectFilter(column.type, filters.type)) {
        return false;
      }

      const description =
        column.descriptionOverride ?? column.description ?? column.dbtDescription ?? '';
      if (!matchesTextFilter(description, filters.description)) {
        return false;
      }

      for (const attr of attrs) {
        if (!this.matchesAttributeFilter(column, attr, filters.attributes[attr.id])) {
          return false;
        }
      }

      return true;
    });
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const tableId = params.get('tableId');
      if (!projectUuid) {
        return;
      }

      const prev = this.projectUuid();
      this.projectUuid.set(projectUuid);
      this.tableId.set(tableId);
      this.activeProjectService.setActiveProject(projectUuid);

      if (prev !== projectUuid || this.dbtTree().length === 0) {
        this.loadProject(projectUuid, tableId);
      } else {
        this.loadEntry(projectUuid, tableId);
      }
    });
  }

  private loadProject(projectUuid: string, tableId: string | null): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      tree: this.lineageService.getDbtTree(projectUuid),
      lineage: this.lineageService.getProjectLineage(projectUuid),
      quality: this.dictionaryService.quality(projectUuid),
    }).subscribe({
      next: ({ tree, lineage, quality }) => {
        this.dbtTree.set(tree.root);
        this.lineage.set(lineage);
        this.quality.set(quality);
        this.loading.set(false);
        this.loadEntry(projectUuid, tableId);
      },
      error: (err) => {
        this.error.set(apiErrorMessage(err, 'Failed to load tables.'));
        this.loading.set(false);
      },
    });
  }

  private loadEntry(projectUuid: string, tableId: string | null): void {
    if (!tableId) {
      this.entry.set(null);
      this.entryError.set(null);
      this.entryLoading.set(false);
      this.columnFilters.set(createEmptyColumnsTableFilters());
      this.sqlViewMode.set('compiled');
      return;
    }

    this.entryLoading.set(true);
    this.entryError.set(null);
    this.columnFilters.set(createEmptyColumnsTableFilters());
    this.dictionaryService.get(projectUuid, tableId).subscribe({
      next: (entry) => {
        this.entry.set(entry);
        this.descriptionDraft.set(entry.descriptionOverride ?? entry.description ?? '');
        this.tagsDraft.set([...(entry.tags ?? [])]);
        this.sqlViewMode.set(preferredModelSqlViewMode(entry.sql, entry.compiledSql));
        this.entryLoading.set(false);
      },
      error: (err) => {
        this.entryError.set(apiErrorMessage(err, 'Failed to load table details.'));
        this.entryLoading.set(false);
      },
    });
  }

  protected onNodeSelected(lineageNodeId: string): void {
    const projectUuid = this.projectUuid();
    if (!projectUuid) {
      return;
    }
    void this.router.navigate(['/projects', projectUuid, 'tables', lineageNodeId]);
  }

  protected setTab(tab: HubTab): void {
    this.activeTab.set(tab);
  }

  protected setSqlViewMode(mode: ModelSqlViewMode): void {
    if (mode === 'compiled' && !this.hasCompiledSql()) {
      return;
    }
    if (mode === 'uncompiled' && !this.hasUncompiledSql()) {
      return;
    }
    this.sqlViewMode.set(mode);
  }

  protected addTagFromInput(event: MatChipInputEvent): void {
    const value = (event.value ?? '').trim();
    if (value) {
      this.addTag(value);
    }
    event.chipInput?.clear();
  }

  protected addTag(value: string): void {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    const current = this.tagsDraft();
    if (current.includes(trimmed)) {
      return;
    }

    this.tagsDraft.set([...current, trimmed]);
  }

  protected removeTag(tag: string): void {
    this.tagsDraft.set(this.tagsDraft().filter((item) => item !== tag));
  }

  protected saveOverview(): void {
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    if (!projectUuid || !entry) {
      return;
    }

    this.saving.set(true);

    this.dictionaryService
      .updateModel(projectUuid, entry.id, {
        descriptionOverride: this.descriptionDraft(),
        tags: this.tagsDraft(),
      })
      .subscribe({
        next: (updated) => {
          this.entry.set(updated);
          this.saving.set(false);
          this.refreshQuality(projectUuid);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  protected saveColumnDescription(columnName: string, description: string): void {
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    if (!projectUuid || !entry) {
      return;
    }

    this.saving.set(true);
    this.dictionaryService
      .updateColumn(projectUuid, entry.id, columnName, {
        descriptionOverride: description,
      })
      .subscribe({
        next: (updated) => {
          this.entry.set(updated);
          this.saving.set(false);
          this.refreshQuality(projectUuid);
        },
        error: () => {
          this.saving.set(false);
        },
      });
  }

  private refreshQuality(projectUuid: string): void {
    this.dictionaryService.quality(projectUuid).subscribe({
      next: (quality) => this.quality.set(quality),
    });
  }

  protected openAddAttributeDialog(): void {
    if (!this.projectUuid() || !this.entry()) {
      return;
    }
    this.showAddAttribute.set(true);
  }

  protected attributeFilterType(attr: CustomAttributeDef): ColumnFilterType {
    switch (attr.type) {
      case 'enum':
      case 'boolean':
        return 'select';
      case 'number':
        return 'number';
      default:
        return 'text';
    }
  }

  protected attributeFilterOptions(attr: CustomAttributeDef): SelectOption[] {
    if (attr.type === 'boolean') {
      return BOOLEAN_ATTRIBUTE_FILTER_OPTIONS;
    }
    if (attr.type === 'enum') {
      return (attr.options ?? []).map((option) => ({ value: option, label: option }));
    }
    return [];
  }

  protected attributeFilterValue(attr: CustomAttributeDef): AttributeFilterValue {
    return this.columnFilters().attributes[attr.id] ?? this.emptyAttributeFilter(attr.type);
  }

  protected updateColumnFilter(
    key: 'name' | 'type' | 'description',
    value: ColumnFilterValue,
  ): void {
    this.columnFilters.update((filters) => ({
      ...filters,
      [key]: value as ColumnsTableFilters[typeof key],
    }));
  }

  protected updateAttributeFilter(attrId: string, value: ColumnFilterValue): void {
    this.columnFilters.update((filters) => ({
      ...filters,
      attributes: {
        ...filters.attributes,
        [attrId]: value as AttributeFilterValue,
      },
    }));
  }

  private emptyAttributeFilter(type: CustomAttributeType): AttributeFilterValue {
    switch (type) {
      case 'enum':
      case 'boolean':
        return emptySelectFilter();
      case 'number':
        return emptyNumberFilter();
      default:
        return emptyTextFilter();
    }
  }

  private matchesAttributeFilter(
    column: DictionaryColumn,
    attr: CustomAttributeDef,
    filter: AttributeFilterValue | undefined,
  ): boolean {
    const activeFilter = filter ?? this.emptyAttributeFilter(attr.type);

    switch (attr.type) {
      case 'enum':
      case 'boolean':
        return matchesSelectFilter(
          this.columnAttributeText(column, attr.id),
          activeFilter as SelectFilterValue,
        );
      case 'number': {
        const numberFilter = activeFilter as NumberFilterValue;
        if (!isNumberFilterActive(numberFilter)) {
          return true;
        }
        const raw = column.custom?.[attr.id];
        if (raw === null || raw === undefined || raw === '') {
          return false;
        }
        const parsed = typeof raw === 'number' ? raw : Number(raw);
        if (!Number.isFinite(parsed)) {
          return false;
        }
        return matchesNumberFilter(parsed, numberFilter);
      }
      default:
        return matchesTextFilter(
          this.columnAttributeText(column, attr.id),
          activeFilter as TextFilterValue,
        );
    }
  }

  protected onAddAttributeCancelled(): void {
    this.showAddAttribute.set(false);
  }

  protected onAddAttributeSaved(result: AddAttributeDialogResult): void {
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    this.showAddAttribute.set(false);
    if (!projectUuid || !entry) {
      return;
    }
    this.addAttributeDefinition(projectUuid, entry, result);
  }

  private addAttributeDefinition(
    projectUuid: string,
    entry: DictionaryEntry,
    result: { name: string; type: CustomAttributeType; options?: string[] },
  ): void {
    const def: CustomAttributeDef = {
      id: this.generateAttributeId(),
      name: result.name,
      type: result.type,
      ...(result.type === 'enum' ? { options: result.options ?? [] } : {}),
    };
    const nextDefs = [...this.attributeDefs(), def];
    const nextCustom = {
      ...(entry.custom ?? {}),
      [CUSTOM_ATTRIBUTE_DEFS_KEY]: nextDefs,
    };

    this.saving.set(true);
    this.dictionaryService.updateModel(projectUuid, entry.id, { custom: nextCustom }).subscribe({
      next: (updated) => {
        this.entry.set(updated);
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  protected deleteAttribute(def: CustomAttributeDef): void {
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    if (!projectUuid || !entry) {
      return;
    }
    if (
      !confirm(
        `Delete the "${def.name}" attribute? This removes its values from every column.`,
      )
    ) {
      return;
    }

    const nextDefs = this.attributeDefs().filter((item) => item.id !== def.id);
    const nextCustom = {
      ...(entry.custom ?? {}),
      [CUSTOM_ATTRIBUTE_DEFS_KEY]: nextDefs,
    };

    const columnCleanups = entry.columns
      .filter((column) => Object.prototype.hasOwnProperty.call(column.custom ?? {}, def.id))
      .map((column) => {
        const rest = { ...(column.custom ?? {}) };
        delete rest[def.id];
        return this.dictionaryService.updateColumn(projectUuid, entry.id, column.name, {
          custom: rest,
        });
      });

    const cleanup$: Observable<unknown> = columnCleanups.length
      ? forkJoin(columnCleanups)
      : of(null);

    this.saving.set(true);
    cleanup$.subscribe({
      next: () => {
        this.dictionaryService.updateModel(projectUuid, entry.id, { custom: nextCustom }).subscribe({
          next: (updated) => {
            this.entry.set(updated);
            this.saving.set(false);
            this.refreshQuality(projectUuid);
          },
          error: () => this.saving.set(false),
        });
      },
      error: () => this.saving.set(false),
    });
  }

  protected columnAttributeText(column: DictionaryColumn, attrId: string): string {
    const value = column.custom?.[attrId];
    return value === null || value === undefined ? '' : String(value);
  }

  protected columnAttributeChecked(column: DictionaryColumn, attrId: string): boolean {
    return !!column.custom?.[attrId];
  }

  protected onAttributeValueChange(
    columnName: string,
    attr: CustomAttributeDef,
    rawValue: string,
  ): void {
    let value: unknown = rawValue;
    if (attr.type === 'number') {
      const trimmed = rawValue.trim();
      const parsed = trimmed === '' ? null : Number(trimmed);
      value = parsed === null || Number.isNaN(parsed) ? null : parsed;
    } else if (rawValue === '') {
      value = null;
    }
    this.saveColumnAttribute(columnName, attr.id, value);
  }

  protected onBooleanAttributeChange(
    columnName: string,
    attr: CustomAttributeDef,
    checked: boolean,
  ): void {
    this.saveColumnAttribute(columnName, attr.id, checked);
  }

  private saveColumnAttribute(columnName: string, attrId: string, value: unknown): void {
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    if (!projectUuid || !entry) {
      return;
    }
    const column = entry.columns.find((col) => col.name === columnName);
    if (!column) {
      return;
    }

    const nextCustom = { ...(column.custom ?? {}) };
    if (value === null || value === undefined) {
      delete nextCustom[attrId];
    } else {
      nextCustom[attrId] = value;
    }

    this.saving.set(true);
    this.dictionaryService
      .updateColumn(projectUuid, entry.id, columnName, { custom: nextCustom })
      .subscribe({
        next: (updated) => {
          this.entry.set(updated);
          this.saving.set(false);
          this.refreshQuality(projectUuid);
        },
        error: () => this.saving.set(false),
      });
  }

  private generateAttributeId(): string {
    const cryptoRef = globalThis.crypto as Crypto | undefined;
    if (cryptoRef?.randomUUID) {
      return cryptoRef.randomUUID();
    }
    return `attr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  protected exploreInCharts(): void {
    const projectUuid = this.projectUuid();
    const tableId = this.tableId();
    if (!projectUuid || !tableId) {
      return;
    }
    void this.router.navigate(['/projects', projectUuid, 'charts', 'new'], {
      queryParams: { table: tableId },
    });
  }

  protected openFullLineage(): void {
    const projectUuid = this.projectUuid();
    const tableId = this.tableId();
    if (!projectUuid) {
      return;
    }
    void this.router.navigate(['/projects', projectUuid, 'lineage'], {
      queryParams: tableId ? { node: tableId } : {},
    });
  }

  /**
   * The embedded lineage graph in the table hub must stay focused on the
   * currently selected model. Unlike the full lineage page, clicking another
   * node here should not navigate away or change the hub's selection — use
   * "Open full project lineage" for that. We intentionally ignore the
   * `nodeSelected` output rather than acting on it.
   */
  protected onGraphNodeSelected(_nodeId: string): void {
    // no-op: keep the hub locked on its own table
  }

  protected onGraphColumnSelected(ref: SelectedColumnRef): void {
    this.selectedColumn.set(ref);
  }

  protected clearSelectedColumn(): void {
    this.selectedColumn.set(null);
  }

  protected onLineageViewModeChange(mode: LineageViewMode): void {
    this.lineageViewMode.set(mode);
  }

  protected onLineageGraphModeChange(mode: LineageGraphMode): void {
    this.lineageGraphMode.set(mode);
  }

  protected onLineageHopDepthChange(depth: LineageHopDepth): void {
    this.lineageHopDepth.set(depth);
  }
}
