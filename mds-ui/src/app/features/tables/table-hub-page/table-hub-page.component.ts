import { ENTER } from '@angular/cdk/keycodes';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
import { UNLIMITED_HOP_DEPTH } from '../../lineage/lineage-focus-utils';
import { LineageService } from '../../lineage/lineage.service';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';
import { DictionaryService } from '../dictionary.service';

type HubTab = 'overview' | 'columns' | 'lineage' | 'sql';

@Component({
  selector: 'app-table-hub-page',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatChipsModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FolderSearchPanelComponent,
    LineageGraphComponent,
    ResizableSidebarDirective,
  ],
  templateUrl: './table-hub-page.component.html',
  styleUrl: './table-hub-page.component.scss',
})
export class TableHubPageComponent {
  private readonly dictionaryService = inject(DictionaryService);
  private readonly lineageService = inject(LineageService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
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
  protected readonly lineageViewMode = signal<LineageViewMode>('models');
  protected readonly lineageGraphMode = signal<LineageGraphMode>('focus');
  protected readonly lineageHopDepth = signal<LineageHopDepth>(UNLIMITED_HOP_DEPTH);
  protected readonly selectedColumn = signal<SelectedColumnRef | null>(null);

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

  protected readonly attributeDefs = computed<CustomAttributeDef[]>(() => {
    const raw = this.entry()?.custom?.[CUSTOM_ATTRIBUTE_DEFS_KEY];
    return Array.isArray(raw) ? (raw as CustomAttributeDef[]) : [];
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
      return;
    }

    this.entryLoading.set(true);
    this.entryError.set(null);
    this.dictionaryService.get(projectUuid, tableId).subscribe({
      next: (entry) => {
        this.entry.set(entry);
        this.descriptionDraft.set(entry.descriptionOverride ?? entry.description ?? '');
        this.tagsDraft.set([...(entry.tags ?? [])]);
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
    const projectUuid = this.projectUuid();
    const entry = this.entry();
    if (!projectUuid || !entry) {
      return;
    }

    const dialogRef = this.dialog.open<
      AddAttributeDialogComponent,
      { existingNames: string[] },
      AddAttributeDialogResult
    >(AddAttributeDialogComponent, {
      width: '420px',
      data: { existingNames: this.attributeDefs().map((def) => def.name) },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.addAttributeDefinition(projectUuid, entry, result);
      }
    });
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
