import { Component, ElementRef, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  ColumnLineageEdge,
  ColumnSelectionEvent,
  LineageColumn,
  LineageDetailTab,
  LineageEdge,
  LineageNode,
  SelectedColumnRef,
} from '../../../core/models/lineage.model';
import {
  computeColumnLineageHighlight,
  columnRefKey,
  getColumnDownstream,
  getColumnUpstream,
  resolveColumnRefs,
  sortColumns,
} from '../lineage-column-utils';

type DetailTab = LineageDetailTab;
type ColumnSortKey = 'name' | 'type';

@Component({
  selector: 'app-lineage-detail-panel',
  imports: [MatIconModule],
  templateUrl: './lineage-detail-panel.component.html',
  styleUrl: './lineage-detail-panel.component.scss',
})
export class LineageDetailPanelComponent {
  readonly node = input.required<LineageNode>();
  readonly nodes = input.required<LineageNode[]>();
  readonly edges = input.required<LineageEdge[]>();
  readonly columnEdges = input<ColumnLineageEdge[]>([]);
  readonly selectedColumn = input<SelectedColumnRef | null>(null);
  readonly requestedTab = input<LineageDetailTab | null>(null);

  readonly nodeSelected = output<string>();
  readonly columnSelected = output<ColumnSelectionEvent>();

  protected readonly activeTab = signal<DetailTab>('overview');
  protected readonly columnSortKey = signal<ColumnSortKey>('name');
  protected readonly columnSortAsc = signal(true);
  protected readonly columnSearch = signal('');

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panelRoot');

  constructor() {
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

  protected setTab(tab: DetailTab): void {
    this.activeTab.set(tab);
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

  protected typeLabel(type: string): string {
    switch (type) {
      case 'source':
        return 'Source';
      case 'staging':
        return 'Staging';
      case 'mart':
        return 'Mart';
      case 'seed':
        return 'Seed';
      default:
        return type;
    }
  }
}
