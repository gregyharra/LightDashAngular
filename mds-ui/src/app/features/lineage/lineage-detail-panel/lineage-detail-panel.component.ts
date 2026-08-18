import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  Renderer2,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import {
  ColumnLineageEdge,
  ColumnSelectionEvent,
  ColumnTransformationType,
  LineageColumn,
  LineageDetailTab,
  LineageEdge,
  LineageNode,
  SelectedColumnRef,
} from '../../../core/models/lineage.model';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import {
  explorePath,
  isExploreableLineageNode,
} from '../../explorer/explore-routes';
import {
  computeColumnLineageHighlight,
  columnRefKey,
  getColumnDownstream,
  getColumnUpstream,
  resolveColumnRefs,
  sortColumns,
} from '../lineage-column-utils';
import {
  inferColumnTransformation,
} from '../column-transformation.utils';
import { TransformationChipComponent } from '../transformation-chip/transformation-chip.component';
import { SqlHighlightComponent } from '../../../shared/sql-highlight/sql-highlight.component';
import {
  ModelSqlViewMode,
  preferredModelSqlViewMode,
  resolveModelSqlDisplay,
} from '../../../shared/sql-highlight/model-sql-view';

type DetailTab = LineageDetailTab;
type ColumnSortKey = 'name' | 'type';

const COLLAPSED_STORAGE_KEY = 'lightdash-lineage-detail-panel-collapsed';
const WIDTH_STORAGE_KEY = 'lightdash-lineage-detail-panel-width';
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_WIDTH = 560;
const COLLAPSED_WIDTH = 44;

@Component({
  selector: 'app-lineage-detail-panel',
  imports: [
    MatButtonToggleModule,
    MatIconModule,
    TransformationChipComponent,
    RouterLink,
    SqlHighlightComponent,
  ],
  templateUrl: './lineage-detail-panel.component.html',
  styleUrl: './lineage-detail-panel.component.scss',
})
export class LineageDetailPanelComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly activeProjectService = inject(ActiveProjectService);

  readonly node = input.required<LineageNode>();
  readonly nodes = input.required<LineageNode[]>();
  readonly edges = input.required<LineageEdge[]>();
  readonly columnEdges = input<ColumnLineageEdge[]>([]);
  readonly selectedColumn = input<SelectedColumnRef | null>(null);
  readonly requestedTab = input<LineageDetailTab | null>(null);

  readonly nodeSelected = output<string>();
  readonly columnSelected = output<ColumnSelectionEvent>();

  protected readonly projectUuid = computed(
    () => this.activeProjectService.activeProjectUuid(),
  );

  protected readonly explorePath = explorePath;
  protected readonly isExploreableLineageNode = isExploreableLineageNode;

  protected readonly collapsed = signal(this.readCollapsedState());
  protected readonly panelWidth = signal(DEFAULT_WIDTH);
  protected readonly resizing = signal(false);
  protected readonly collapsedWidth = COLLAPSED_WIDTH;
  protected readonly activeTab = signal<DetailTab>('overview');
  protected readonly sqlViewMode = signal<ModelSqlViewMode>('compiled');
  protected readonly columnSortKey = signal<ColumnSortKey>('name');
  protected readonly columnSortAsc = signal(true);
  protected readonly columnSearch = signal('');

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panelRoot');
  private lastSqlNodeId: string | null = null;
  private isDragging = false;
  private startX = 0;
  private startWidth = 0;
  private unlistenMove?: () => void;
  private unlistenUp?: () => void;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.panelWidth.set(this.readSavedWidth());
    }

    this.destroyRef.onDestroy(() => {
      this.stopResize();
    });

    effect(() => {
      const node = this.node();
      if (node.id === this.lastSqlNodeId) {
        return;
      }
      this.lastSqlNodeId = node.id;
      this.sqlViewMode.set(preferredModelSqlViewMode(node.sql, node.compiledSql));
    });

    effect(() => {
      if (!this.selectedColumn()) {
        this.activeTab.set('overview');
        return;
      }

      const requested = this.requestedTab();
      if (requested) {
        this.activeTab.set(requested);
      }
    });

    effect(() => {
      const selected = this.selectedColumn();
      const node = this.node();
      const tab = this.activeTab();
      if (!selected || selected.nodeId !== node.id || tab !== 'columns') {
        return;
      }

      queueMicrotask(() => {
        requestAnimationFrame(() => {
          const panel = this.panelRef()?.nativeElement;
          const row = panel?.querySelector(
            `.lineage-detail__table-row[data-column-name="${selected.columnName}"]`,
          );
          row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      });
    });
  }

  protected readonly hasCompiledSql = computed(() => !!this.node().compiledSql?.trim());
  protected readonly hasUncompiledSql = computed(() => !!this.node().sql?.trim());
  protected readonly hasAnySql = computed(
    () => this.hasCompiledSql() || this.hasUncompiledSql(),
  );
  protected readonly displaySql = computed(() => {
    const node = this.node();
    return resolveModelSqlDisplay(node.sql, node.compiledSql, this.sqlViewMode());
  });
  protected readonly showCompiledUnavailableHint = computed(
    () => !this.hasCompiledSql() && this.hasUncompiledSql(),
  );

  protected readonly upstream = computed(() => {
    const node = this.node();
    const upstreamIds = this.edges()
      .filter((edge) => edge.target === node.id)
      .map((edge) => edge.source);
    return this.nodes().filter((n) => upstreamIds.includes(n.id));
  });

  protected readonly downstream = computed(() => {
    const node = this.node();
    const downstreamIds = this.edges()
      .filter((edge) => edge.source === node.id)
      .map((edge) => edge.target);
    return this.nodes().filter((n) => downstreamIds.includes(n.id));
  });

  protected readonly filteredColumns = computed(() => {
    const node = this.node();
    const columns = node.columns ?? [];
    const query = this.columnSearch().trim().toLowerCase();
    const filtered = query
      ? columns.filter(
          (col) =>
            col.name.toLowerCase().includes(query) ||
            col.type.toLowerCase().includes(query) ||
            col.description?.toLowerCase().includes(query),
        )
      : columns;
    const sorted = sortColumns(filtered, this.columnSortKey());
    return this.columnSortAsc() ? sorted : [...sorted].reverse();
  });

  protected readonly columnUpstream = computed(() => {
    const selected = this.selectedColumn();
    if (!selected || selected.nodeId !== this.node().id) {
      return [];
    }
    return getColumnUpstream(
      this.columnEdges(),
      this.nodes(),
      selected.nodeId,
      selected.columnName,
    );
  });

  protected readonly columnDownstream = computed(() => {
    const selected = this.selectedColumn();
    if (!selected || selected.nodeId !== this.node().id) {
      return [];
    }
    return getColumnDownstream(
      this.columnEdges(),
      this.nodes(),
      selected.nodeId,
      selected.columnName,
    );
  });

  protected readonly lineageColumnUpstream = computed(() => {
    const selected = this.selectedColumn();
    if (!selected) {
      return [];
    }
    const highlight = computeColumnLineageHighlight(this.columnEdges(), selected);
    return resolveColumnRefs(highlight.upstreamColumnKeys, this.nodes());
  });

  protected readonly lineageColumnDownstream = computed(() => {
    const selected = this.selectedColumn();
    if (!selected) {
      return [];
    }
    const highlight = computeColumnLineageHighlight(this.columnEdges(), selected);
    return resolveColumnRefs(highlight.downstreamColumnKeys, this.nodes());
  });

  protected readonly hasSelectedColumn = computed(() => this.selectedColumn() !== null);

  protected readonly selectedColumnNodeName = computed(() => {
    const selected = this.selectedColumn();
    if (!selected) {
      return '';
    }
    return this.nodes().find((n) => n.id === selected.nodeId)?.name ?? '';
  });

  protected toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
    }
  }

  protected onResizeStart(event: PointerEvent): void {
    if (this.collapsed()) {
      return;
    }

    const handle = event.currentTarget as HTMLElement;
    event.preventDefault();
    this.isDragging = true;
    this.resizing.set(true);
    this.startX = event.clientX;
    this.startWidth = this.panelWidth();
    handle.setPointerCapture(event.pointerId);
    this.renderer.addClass(document.body, 'lineage-detail--resizing');

    this.unlistenMove = this.renderer.listen('document', 'pointermove', (moveEvent: PointerEvent) =>
      this.onResizeMove(moveEvent),
    );
    this.unlistenUp = this.renderer.listen('document', 'pointerup', (upEvent: PointerEvent) =>
      this.onResizeEnd(upEvent, handle),
    );
  }

  private onResizeMove(event: PointerEvent): void {
    if (!this.isDragging || this.collapsed()) {
      return;
    }

    // Right-side panel: drag left to widen.
    const width = this.clamp(this.startWidth - (event.clientX - this.startX));
    this.panelWidth.set(width);
  }

  private onResizeEnd(event: PointerEvent, handle: HTMLElement): void {
    if (!this.isDragging) {
      return;
    }

    handle.releasePointerCapture(event.pointerId);
    this.stopResize();

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(this.panelWidth()));
    }
  }

  private stopResize(): void {
    this.isDragging = false;
    this.resizing.set(false);
    this.renderer.removeClass(document.body, 'lineage-detail--resizing');
    this.unlistenMove?.();
    this.unlistenUp?.();
    this.unlistenMove = undefined;
    this.unlistenUp = undefined;
  }

  protected setTab(tab: DetailTab): void {
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

  protected onColumnSearch(value: string): void {
    this.columnSearch.set(value);
  }

  protected toggleColumnSort(key: ColumnSortKey): void {
    if (this.columnSortKey() === key) {
      this.columnSortAsc.update((v) => !v);
    } else {
      this.columnSortKey.set(key);
      this.columnSortAsc.set(true);
    }
  }

  protected sortIndicator(key: ColumnSortKey): string {
    if (this.columnSortKey() !== key) {
      return '';
    }
    return this.columnSortAsc() ? '↑' : '↓';
  }

  protected isSelectedColumn(column: LineageColumn): boolean {
    const selected = this.selectedColumn();
    return (
      !!selected &&
      selected.nodeId === this.node().id &&
      selected.columnName === column.name
    );
  }

  protected isColumnInLineagePath(column: LineageColumn): boolean {
    const selected = this.selectedColumn();
    if (!selected || this.isSelectedColumn(column)) {
      return false;
    }

    const highlight = computeColumnLineageHighlight(this.columnEdges(), selected);
    return highlight.columnKeys.has(columnRefKey(this.node().id, column.name));
  }

  protected selectRelatedNode(nodeId: string): void {
    this.nodeSelected.emit(nodeId);
  }

  protected selectColumn(column: LineageColumn): void {
    const node = this.node();
    this.columnSelected.emit({
      ref: { nodeId: node.id, columnName: column.name },
      detailTab: 'columns',
    });
  }

  protected selectRelatedColumn(nodeId: string, columnName: string): void {
    this.columnSelected.emit({
      ref: { nodeId, columnName },
      detailTab: 'lineage',
    });
  }

  private readCollapsedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  }

  private readSavedWidth(): number {
    const saved = localStorage.getItem(WIDTH_STORAGE_KEY);
    const parsed = saved ? Number.parseInt(saved, 10) : Number.NaN;
    return Number.isFinite(parsed) ? this.clamp(parsed) : DEFAULT_WIDTH;
  }

  private clamp(width: number): number {
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
  }

  protected typeLabel(type: string): string {
    switch (type) {
      case 'source':
        return 'Source';
      case 'staging':
        return 'Bronze';
      case 'intermediate':
        return 'Silver';
      case 'mart':
        return 'Gold';
      case 'seed':
        return 'Seed';
      default:
        return type;
    }
  }

  protected columnTransformation(column: LineageColumn): ColumnTransformationType {
    const node = this.node();
    return inferColumnTransformation(node, column, this.columnEdges(), this.nodes());
  }
}
