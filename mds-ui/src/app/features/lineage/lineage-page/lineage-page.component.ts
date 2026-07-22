import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActiveProjectService } from '../../../core/services/active-project.service';
import { ApiErrorService } from '../../../core/api/api-error.service';
import {
  DbtTreeNode,
  LineageDetailTab,
  LineageGraphMode,
  LineageHopDepth,
  LineageViewMode,
  ProjectLineage,
  SelectedColumnRef,
} from '../../../core/models/lineage.model';
import { UNLIMITED_HOP_DEPTH } from '../lineage-focus-utils';
import { LineageService } from '../lineage.service';
import { LineageGraphComponent } from '../lineage-graph/lineage-graph.component';
import { LineageDetailPanelComponent } from '../lineage-detail-panel/lineage-detail-panel.component';
import { FolderSearchPanelComponent } from '../folder-search-panel/folder-search-panel.component';
import { findTreeNodeByLineageId } from '../dbt-tree-utils';
import { ResizableSidebarDirective } from '../../../layout/resizable-sidebar/resizable-sidebar.directive';

@Component({
  selector: 'app-lineage-page',
  imports: [
    RouterLink,
    MatIconModule,
    MatProgressSpinnerModule,
    LineageGraphComponent,
    LineageDetailPanelComponent,
    FolderSearchPanelComponent,
    ResizableSidebarDirective,
  ],
  templateUrl: './lineage-page.component.html',
  styleUrl: './lineage-page.component.scss',
})
export class LineagePageComponent {
  private readonly lineageService = inject(LineageService);
  private readonly apiErrorService = inject(ApiErrorService);
  private readonly route = inject(ActivatedRoute);
  protected readonly activeProjectService = inject(ActiveProjectService);

  protected readonly projectUuid = signal<string | null>(null);
  protected readonly lineage = signal<ProjectLineage | null>(null);
  protected readonly dbtTree = signal<DbtTreeNode[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedNodeId = signal<string | null>(null);
  protected readonly selectedColumn = signal<SelectedColumnRef | null>(null);
  protected readonly viewMode = signal<LineageViewMode>('models');
  protected readonly graphMode = signal<LineageGraphMode>('focus');
  protected readonly hopDepth = signal<LineageHopDepth>(UNLIMITED_HOP_DEPTH);
  protected readonly requestedDetailTab = signal<LineageDetailTab | null>(null);

  protected readonly selectedNode = computed(() => {
    const lineage = this.lineage();
    const nodeId = this.selectedNodeId();
    if (!lineage || !nodeId) {
      return null;
    }
    return lineage.nodes.find((node) => node.id === nodeId) ?? null;
  });

  protected readonly selectedDbtPath = computed(() => {
    const node = this.selectedNode();
    if (node?.dbtPath) {
      return node.dbtPath;
    }
    const nodeId = this.selectedNodeId();
    if (!nodeId) {
      return null;
    }
    const treeNode = findTreeNodeByLineageId(this.dbtTree(), nodeId);
    return treeNode?.path ?? null;
  });

  protected readonly columnEdgeCount = computed(() => this.lineage()?.columnEdges?.length ?? 0);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const projectUuid = params.get('projectUuid');
      if (!projectUuid) {
        return;
      }

      this.projectUuid.set(projectUuid);
      this.activeProjectService.setActiveProject(projectUuid);
      this.loadLineage(projectUuid);
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.selectedColumn.set(null);
  }

  private loadLineage(projectUuid: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.selectedNodeId.set(null);
    this.selectedColumn.set(null);
    this.viewMode.set('models');
    this.graphMode.set('focus');
    this.hopDepth.set(UNLIMITED_HOP_DEPTH);

    this.lineageService.getProjectLineage(projectUuid).subscribe({
      next: (lineage) => {
        this.lineage.set(lineage);
        this.loading.set(false);
        if (lineage.nodes.length > 0) {
          const fctOrders = lineage.nodes.find((n) => n.name === 'fct_orders');
          const firstMart = lineage.nodes.find((n) => n.type === 'mart');
          this.selectedNodeId.set(fctOrders?.id ?? firstMart?.id ?? lineage.nodes[0].id);
        }
      },
      error: (err) => {
        this.error.set(this.apiErrorService.showTransient(err, 'Failed to load lineage.'));
        this.loading.set(false);
      },
    });

    this.lineageService.getDbtTree(projectUuid).subscribe({
      next: (tree) => this.dbtTree.set(tree.root),
      error: () => this.dbtTree.set([]),
    });
  }

  protected onNodeSelected(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    const hadColumnSelection = this.selectedColumn() !== null;
    this.selectedColumn.set(null);
    this.requestedDetailTab.set('overview');
    if (hadColumnSelection && this.viewMode() === 'columns') {
      this.viewMode.set('models');
    }
  }

  protected onColumnSelected(ref: SelectedColumnRef): void {
    this.selectedColumn.set(ref);
    this.selectedNodeId.set(ref.nodeId);
    this.viewMode.set('columns');
    this.requestedDetailTab.set('columns');
  }

  protected onDetailColumnSelected(event: {
    ref: SelectedColumnRef;
    detailTab?: LineageDetailTab;
  }): void {
    this.selectedColumn.set(event.ref);
    this.selectedNodeId.set(event.ref.nodeId);
    this.viewMode.set('columns');
    this.requestedDetailTab.set(event.detailTab ?? 'columns');
  }

  protected onColumnSelectionCleared(): void {
    this.selectedColumn.set(null);
    this.requestedDetailTab.set('overview');
  }

  protected onNodeSelectionCleared(): void {
    this.selectedColumn.set(null);
    this.selectedNodeId.set(null);
    this.requestedDetailTab.set(null);
  }

  protected onViewModeChange(mode: LineageViewMode): void {
    this.viewMode.set(mode);
  }

  protected onGraphModeChange(mode: LineageGraphMode): void {
    this.graphMode.set(mode);
  }

  protected onHopDepthChange(depth: LineageHopDepth): void {
    this.hopDepth.set(depth);
  }

  protected formatCompiledAt(isoDate: string): string {
    return new Date(isoDate).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
