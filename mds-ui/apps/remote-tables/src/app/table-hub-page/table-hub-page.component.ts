import { ENTER } from '@angular/cdk/keycodes';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  CUSTOM_ATTRIBUTE_DEFS_KEY,
  CustomAttributeDef,
  CustomAttributeType,
  DictionaryColumn,
  DictionaryEntry,
  ColumnTransformationType,
  LineageColumn,
  LineageGraphMode,
  LineageHopDepth,
  LineageViewMode,
  SelectedColumnRef,
  LinkDialogSavePayload,
  ModelJoinView,
  ModelLinkOption,
} from '@mds-ui/models';
import {
  AddAttributeDialogComponent,
  AddAttributeDialogResult,
} from './add-attribute-dialog/add-attribute-dialog.component';

import { inferColumnTransformation } from '@mds-ui/shared';
import { FolderSearchPanelComponent } from '@mds-ui/shared';
import { LineageGraphComponent } from '@mds-ui/shared';
import { TransformationChipComponent } from '@mds-ui/shared';
import { ResizableSidebarDirective } from '@mds-ui/shared';
import { ProjectBrowseNavComponent } from '@mds-ui/shared';
import { FilterableLinksTableComponent } from '@mds-ui/shared';
import { LinkDialogComponent } from '@mds-ui/shared';

import { SqlHighlightComponent } from '@mds-ui/shared';
import {
  ModelSqlViewMode,
  preferredModelSqlViewMode,
  resolveModelSqlDisplay,
} from '@mds-ui/shared';
import { TableHubPageFacade } from '../core/facades/table-hub-page.facade';
import {
  ColumnFilterType,
  ColumnFilterValue,
  ContentListColumnHeaderComponent,
} from '@mds-ui/shared';
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
} from '@mds-ui/shared';

type HubTab = 'overview' | 'columns' | 'links' | 'lineage' | 'sql';

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
    MatButtonModule,
    MatButtonToggleModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    AddAttributeDialogComponent,
    ContentListColumnHeaderComponent,
    FilterableLinksTableComponent,
    FolderSearchPanelComponent,
    LineageGraphComponent,
    LinkDialogComponent,
    ResizableSidebarDirective,
    ProjectBrowseNavComponent,
    SqlHighlightComponent,
    TransformationChipComponent,
  ],
  templateUrl: './table-hub-page.component.html',
  styleUrl: './table-hub-page.component.scss',
})
export class TableHubPageComponent {
  protected readonly enableTagEditing = ENABLE_TABLE_HUB_TAG_EDITING;

  private readonly facade = inject(TableHubPageFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  protected readonly projectUuid = this.facade.projectUuid;
  protected readonly tableId = this.facade.tableId;
  protected readonly dbtTree = this.facade.dbtTree;
  protected readonly lineage = this.facade.lineage;
  protected readonly entry = this.facade.entry;
  protected readonly quality = this.facade.quality;
  protected readonly loading = this.facade.loading;
  protected readonly entryLoading = this.facade.entryLoading;
  protected readonly error = this.facade.error;
  protected readonly entryError = this.facade.entryError;
  protected readonly saving = this.facade.saving;
  protected readonly activeTab = signal<HubTab>('overview');
  protected readonly sqlViewMode = signal<ModelSqlViewMode>('compiled');
  protected readonly lineageViewMode = signal<LineageViewMode>('models');
  protected readonly lineageGraphMode = signal<LineageGraphMode>('focus');
  protected readonly lineageHopDepth = signal<LineageHopDepth>(0);
  protected readonly selectedColumn = signal<SelectedColumnRef | null>(null);
  protected readonly showAddAttribute = signal(false);
  protected readonly showLinkDialog = signal(false);
  protected readonly editingLink = signal<ModelJoinView | null>(null);
  protected readonly modelJoins = this.facade.modelJoins;
  protected readonly linksLoading = this.facade.linksLoading;
  protected readonly columnFilters = signal<ColumnsTableFilters>(createEmptyColumnsTableFilters());

  protected readonly descriptionDraft = signal('');
  protected readonly tagsDraft = signal<string[]>([]);
  protected readonly tagSeparatorKeys = [ENTER] as const;
  private draftEntryId: string | null = null;

  protected readonly selectedNode = computed(() => {
    const id = this.tableId();
    const lineage = this.lineage();
    if (!id || !lineage) {
      return null;
    }
    return lineage.nodes.find((node) => node.id === id || node.name === id) ?? null;
  });

  protected columnTransformation(
    column: DictionaryColumn,
  ): ColumnTransformationType | null {
    const node = this.selectedNode();
    const lineage = this.lineage();
    if (!node || !lineage) {
      return null;
    }

    const lineageColumn: LineageColumn =
      node.columns?.find((col) => col.name === column.name) ?? {
        name: column.name,
        type: column.type,
      };

    return inferColumnTransformation(
      node,
      lineageColumn,
      lineage.columnEdges ?? [],
      lineage.nodes,
    );
  }

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

  protected readonly modelLinkOptions = computed<ModelLinkOption[]>(() => {
    const lineage = this.lineage();
    if (!lineage) {
      return [];
    }
    return lineage.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      columns: (node.columns ?? []).map((column) => ({
        name: column.name,
        type: column.type,
      })),
    }));
  });

  protected readonly linksCount = computed(() => this.modelJoins().length);

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
    effect(() => {
      const entry = this.entry();
      const entryId = entry?.id ?? null;
      if (entryId !== this.draftEntryId) {
        this.resetEntryDrafts(entry);
      }
    });
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      const tableId = params.get('tableId');
      if (!projectUuid) {
        return;
      }
      this.columnFilters.set(createEmptyColumnsTableFilters());
      this.sqlViewMode.set('compiled');
      this.facade.load(projectUuid, tableId);
    });
  }

  protected onNodeSelected(lineageNodeId: string): void {
    this.facade.selectTable(lineageNodeId);
  }

  protected setTab(tab: HubTab): void {
    this.activeTab.set(tab);
    if (tab === 'links') {
      this.facade.loadLinks();
    }
  }

  protected openAddLinkDialog(): void {
    this.editingLink.set(null);
    this.showLinkDialog.set(true);
  }

  protected onEditLink(link: ModelJoinView): void {
    this.editingLink.set(link);
    this.showLinkDialog.set(true);
  }

  protected onDeleteLink(link: ModelJoinView): void {
    this.facade.deleteLink(link);
  }

  protected onLinkDialogCancelled(): void {
    this.showLinkDialog.set(false);
    this.editingLink.set(null);
  }

  protected onLinkDialogSaved(payload: LinkDialogSavePayload): void {
    this.facade.saveLink(payload, () => {
      this.showLinkDialog.set(false);
      this.editingLink.set(null);
    });
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
    this.facade.saveOverview(
      this.descriptionDraft(),
      this.tagsDraft(),
      (entry) => this.resetEntryDrafts(entry),
    );
  }

  private resetEntryDrafts(entry: DictionaryEntry | null): void {
    this.draftEntryId = entry?.id ?? null;
    this.descriptionDraft.set(
      entry?.descriptionOverride ?? entry?.description ?? '',
    );
    this.tagsDraft.set([...(entry?.tags ?? [])]);
    this.sqlViewMode.set(
      entry
        ? preferredModelSqlViewMode(entry.sql, entry.compiledSql)
        : 'compiled',
    );
  }

  protected saveColumnDescription(columnName: string, description: string): void {
    this.facade.saveColumnDescription(columnName, description);
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
      return BOOLEAN_ATTRIBUTE_FILTER_OPTIONS.map((option) => ({
        ...option,
        label: option.value === '' ? this.translate.instant('tables.unset') : option.label,
      }));
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
    this.showAddAttribute.set(false);
    this.facade.addAttribute(result);
  }

  protected deleteAttribute(def: CustomAttributeDef): void {
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    if (!projectUuid || !entry) {
      return;
    }
    if (
      !confirm(
        this.translate.instant('tables.attributes.deleteConfirm', { name: def.name }),
      )
    ) {
      return;
    }

    this.facade.deleteAttribute(def);
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
    this.facade.saveColumnAttribute(columnName, attr.id, value);
  }

  protected onBooleanAttributeChange(
    columnName: string,
    attr: CustomAttributeDef,
    checked: boolean,
  ): void {
    this.facade.saveColumnAttribute(columnName, attr.id, checked);
  }

  protected exploreInCharts(): void {
    this.facade.exploreInCharts();
  }

  protected openFullLineage(): void {
    this.facade.openFullLineage();
  }

  /**
   * The embedded lineage graph in the table hub must stay focused on the
   * currently selected model. Unlike the full lineage page, clicking another
   * node here should not navigate away or change the hub's selection — use
   * "Open full project lineage" for that. We intentionally ignore the
   * `nodeSelected` output rather than acting on it.
   */
  protected onGraphNodeSelected(nodeId: string): void {
    void nodeId; // Keep the embedded graph locked on its own table.
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
