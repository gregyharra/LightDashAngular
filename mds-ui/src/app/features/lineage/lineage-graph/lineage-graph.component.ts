import { DecimalPipe } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  ColumnLineageEdge,
  ColumnTransformationType,
  LineageColumn,
  LineageEdge,
  LineageGraphMode,
  LineageHopDepth,
  LineageNode,
  LineageNodePosition,
  LineageViewMode,
  SelectedColumnRef,
} from '../../../core/models/lineage.model';
import {
  LINEAGE_COLUMN_ROW_HEIGHT,
  LINEAGE_NODE_HEADER_HEIGHT,
  buildColumnEdgePaths,
  columnRefKey,
  computeColumnLineageHighlight,
  getExpandedNodeHeight,
  getNodeIdsFromColumnKeys,
} from '../lineage-column-utils';
import {
  buildEdgePaths,
  getGraphBounds,
  layoutLineageNodes,
} from '../lineage-layout';
import {
  computeMaxHopDepth,
  computeRelatedNodeIds,
  isEdgeInSubgraph,
  UNLIMITED_HOP_DEPTH,
} from '../lineage-focus-utils';
import {
  inferColumnTransformation,
  transformationChipLabel,
  transformationChipWidth,
  transformationCssVar,
  transformationDescription,
  TransformationChipMode,
} from '../column-transformation.utils';
import { TransformationLegendComponent } from '../transformation-legend/transformation-legend.component';

const NODE_COLORS: Record<string, { fill: string; stroke: string; badge: string }> = {
  source: { fill: '#edf2ff', stroke: '#748ffc', badge: '#4263eb' },
  staging: { fill: '#fff9db', stroke: '#fcc419', badge: '#f59f00' },
  mart: { fill: '#e6fcf5', stroke: '#38d9a9', badge: '#12b886' },
  seed: { fill: '#f3f0ff', stroke: '#b197fc', badge: '#7950f2' },
};

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const DRAG_THRESHOLD_PX = 4;
const SNAP_GRID = 8;
/** Distance (screen px) from a canvas edge at which node-drag auto-panning kicks in. */
const AUTO_PAN_EDGE_PX = 56;
/** Max auto-pan speed (screen px per animation frame) once the pointer is well past an edge. */
const AUTO_PAN_MAX_SPEED = 22;

/**
 * How fast the canvas should auto-pan when a dragged node's pointer sits near/beyond
 * one edge of `[edgeStart, edgeEnd]`. Returns a signed screen-px/frame velocity — positive
 * pans toward higher coordinates (right/down), negative toward lower ones (left/up). This
 * lets a node be dragged indefinitely in any direction: once the pointer reaches the edge
 * of the visible canvas (and can't physically move further on screen), the view keeps
 * scrolling underneath it every frame instead of the drag stalling.
 */
function edgeAutoPanVelocity(pointerPos: number, edgeStart: number, edgeEnd: number): number {
  if (pointerPos > edgeEnd - AUTO_PAN_EDGE_PX) {
    const depth = Math.min(1, (pointerPos - (edgeEnd - AUTO_PAN_EDGE_PX)) / AUTO_PAN_EDGE_PX);
    return depth * AUTO_PAN_MAX_SPEED;
  }
  if (pointerPos < edgeStart + AUTO_PAN_EDGE_PX) {
    const depth = Math.min(1, (edgeStart + AUTO_PAN_EDGE_PX - pointerPos) / AUTO_PAN_EDGE_PX);
    return -depth * AUTO_PAN_MAX_SPEED;
  }
  return 0;
}

const REORGANIZE_TRANSITION_MS = 280;

@Component({
  selector: 'app-lineage-graph',
  imports: [DecimalPipe, MatIconModule, TransformationLegendComponent],
  templateUrl: './lineage-graph.component.html',
  styleUrl: './lineage-graph.component.scss',
})
export class LineageGraphComponent implements AfterViewInit {
  readonly nodes = input.required<LineageNode[]>();
  readonly edges = input.required<LineageEdge[]>();
  readonly columnEdges = input<ColumnLineageEdge[]>([]);
  readonly selectedNodeId = input<string | null>(null);
  readonly selectedColumn = input<SelectedColumnRef | null>(null);
  readonly viewMode = input<LineageViewMode>('models');
  readonly graphMode = input<LineageGraphMode>('focus');
  readonly hopDepth = input<LineageHopDepth>(UNLIMITED_HOP_DEPTH);

  readonly nodeSelected = output<string>();
  readonly columnSelected = output<SelectedColumnRef>();
  readonly columnSelectionCleared = output<void>();
  readonly nodeSelectionCleared = output<void>();
  readonly viewModeChange = output<LineageViewMode>();
  readonly graphModeChange = output<LineageGraphMode>();
  readonly hopDepthChange = output<LineageHopDepth>();

  private readonly canvasRef = viewChild<ElementRef<HTMLDivElement>>('canvas');

  protected readonly zoom = signal(1);
  protected readonly panX = signal(0);
  protected readonly panY = signal(0);
  protected readonly isPanning = signal(false);
  protected readonly expandedNodeIds = signal<Set<string>>(new Set());
  /** Expanded nodes baked into the last auto-layout (reorganize or columns view). */
  private readonly layoutExpandedNodeIds = signal<ReadonlySet<string>>(new Set());
  protected readonly customPositions = signal<Map<string, { x: number; y: number }>>(new Map());
  protected readonly layoutRevision = signal(0);
  protected readonly isReorganizing = signal(false);
  protected readonly draggingNodeId = signal<string | null>(null);
  protected readonly transformationChipMode = signal<TransformationChipMode>('compact');
  protected readonly transformationFilter = signal<ColumnTransformationType | null>(null);

  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private canvasPointerStartX = 0;
  private canvasPointerStartY = 0;
  private dragNodeId: string | null = null;
  private dragPointerId: number | null = null;
  private dragStartClientX = 0;
  private dragStartClientY = 0;
  private dragStartNodeX = 0;
  private dragStartNodeY = 0;
  private dragMoved = false;
  private lastCanvasClickAt = 0;
  private lastPointerClientX = 0;
  private lastPointerClientY = 0;
  private autoPanRafId: number | null = null;

  protected readonly positions = computed(() => {
    this.layoutRevision();
    const nodes = this.displayNodes();
    const edges = this.displayEdges();
    const viewMode = this.effectiveViewMode();
    const expanded = this.expandedNodeIds();

    const layoutExpandedIds =
      viewMode === 'columns'
        ? new Set(nodes.map((node) => node.id))
        : this.layoutExpandedNodeIds();

    let positions = layoutLineageNodes(nodes, edges, viewMode, layoutExpandedIds);
    positions = this.applyExpandedHeights(positions, nodes, expanded, viewMode);

    const custom = this.customPositions();
    if (custom.size === 0) {
      return positions;
    }

    const merged = new Map(positions);
    for (const [nodeId, offset] of custom) {
      const base = merged.get(nodeId);
      if (base) {
        merged.set(nodeId, { ...base, x: offset.x, y: offset.y });
      }
    }
    return merged;
  });

  protected readonly bounds = computed(() => getGraphBounds(this.positions()));

  protected readonly edgePaths = computed(() =>
    buildEdgePaths(this.displayEdges(), this.positions()),
  );

  protected readonly columnEdgePaths = computed(() => {
    const mode = this.effectiveViewMode();
    const expanded = this.expandedNodeIds();
    const selectedColumn = this.selectedColumn();
    const highlight = this.columnHighlight();

    if (mode !== 'columns' && expanded.size === 0 && !selectedColumn) {
      return [];
    }

    const allPaths = buildColumnEdgePaths(this.columnEdges(), this.positions(), this.displayNodes());

    if (selectedColumn) {
      return allPaths.filter((item) => highlight.edgeKeys.has(item.key));
    }

    if (mode === 'columns') {
      return allPaths;
    }

    return allPaths.filter(
      (item) =>
        expanded.has(item.edge.sourceNodeId) && expanded.has(item.edge.targetNodeId),
    );
  });

  protected readonly columnHighlight = computed(() =>
    computeColumnLineageHighlight(
      this.columnEdges(),
      this.selectedColumn(),
      this.hopDepth(),
    ),
  );

  protected readonly columnLineageNodeIds = computed(() =>
    getNodeIdsFromColumnKeys(this.columnHighlight().columnKeys),
  );

  protected readonly relatedNodeIds = computed(() => {
    const nodeId = this.selectedNodeId();
    if (!nodeId) {
      return null;
    }
    return computeRelatedNodeIds(nodeId, this.edges(), this.hopDepth());
  });

  protected readonly hopDepthControlsEnabled = computed(() => this.selectedNodeId() !== null);

  protected readonly hopDepthLabel = computed(() => {
    const depth = this.hopDepth();
    if (depth === UNLIMITED_HOP_DEPTH) {
      return '∞';
    }
    return String(depth);
  });

  protected readonly canDecreaseHopDepth = computed(() => {
    if (!this.hopDepthControlsEnabled()) {
      return false;
    }
    const depth = this.hopDepth();
    return depth === UNLIMITED_HOP_DEPTH || depth > 1;
  });

  protected readonly canIncreaseHopDepth = computed(() => {
    if (!this.hopDepthControlsEnabled()) {
      return false;
    }
    const depth = this.hopDepth();
    if (depth === UNLIMITED_HOP_DEPTH) {
      return false;
    }
    const nodeId = this.selectedNodeId();
    if (!nodeId) {
      return false;
    }
    const maxDepth = computeMaxHopDepth(nodeId, this.edges());
    return depth < maxDepth;
  });

  protected readonly isUnlimitedHopDepth = computed(
    () => this.hopDepth() === UNLIMITED_HOP_DEPTH,
  );

  protected readonly displayNodes = computed(() => {
    const related = this.relatedNodeIds();
    if (!related || this.graphMode() === 'full') {
      return this.nodes();
    }
    return this.nodes().filter((node) => related.has(node.id));
  });

  protected readonly displayEdges = computed(() => {
    const related = this.relatedNodeIds();
    if (!related || this.graphMode() === 'full') {
      return this.edges();
    }
    return this.edges().filter((edge) => isEdgeInSubgraph(edge, related));
  });

  protected readonly transform = computed(
    () => `translate(${this.panX()}px, ${this.panY()}px) scale(${this.zoom()})`,
  );

  protected readonly minimapScale = computed(() => {
    const bounds = this.bounds();
    const maxDim = Math.max(bounds.width, bounds.height);
    return maxDim > 0 ? 120 / maxDim : 1;
  });

  protected readonly minimapViewport = computed(() => {
    const canvas = this.canvasRef()?.nativeElement;
    const bounds = this.bounds();
    if (!canvas || bounds.width <= 0 || bounds.height <= 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const zoom = this.zoom();
    const viewWidth = canvas.clientWidth / zoom;
    const viewHeight = canvas.clientHeight / zoom;
    const viewX = -this.panX() / zoom;
    const viewY = -this.panY() / zoom;

    return { x: viewX, y: viewY, width: viewWidth, height: viewHeight };
  });

  constructor() {
    effect(() => {
      this.displayNodes();
      this.displayEdges();
      this.viewMode();
      this.graphMode();
      this.hopDepth();
      if (!this.selectedColumn()) {
        this.scheduleFitToView();
      }
    });

    effect(() => {
      // Column selection must only highlight lineage — never auto-zoom/pan.
      // Intentionally do not read selectedColumn() here.
      this.viewMode();
      const nodeId = this.selectedNodeId();
      if (nodeId) {
        this.scheduleCenterOnNode(nodeId);
      }
    });

    effect(() => {
      const mode = this.viewMode();
      const selectedColumn = this.selectedColumn();

      if (mode === 'columns') {
        const nextIds = this.displayNodes().map((n) => n.id);
        const current = this.expandedNodeIds();
        if (
          nextIds.length === current.size &&
          nextIds.every((id) => current.has(id))
        ) {
          return;
        }
        this.expandedNodeIds.set(new Set(nextIds));
        return;
      }

      if (selectedColumn) {
        const nextIds = [...this.columnLineageNodeIds()];
        const current = this.expandedNodeIds();
        if (
          nextIds.length === current.size &&
          nextIds.every((id) => current.has(id))
        ) {
          return;
        }
        this.expandedNodeIds.set(new Set(nextIds));
      }
    });
  }

  ngAfterViewInit(): void {
    this.scheduleFitToView();
  }

  protected effectiveViewMode(): LineageViewMode {
    return this.viewMode();
  }

  private scheduleFitToView(): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => this.fitToView());
    });
  }

  protected nodeColors(type: string): { fill: string; stroke: string; badge: string } {
    return NODE_COLORS[type] ?? NODE_COLORS['staging'];
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

  protected isNodeExpanded(nodeId: string): boolean {
    return this.expandedNodeIds().has(nodeId) || this.viewMode() === 'columns';
  }

  protected toggleNodeExpand(nodeId: string, event: Event): void {
    event.stopPropagation();
    if (this.viewMode() === 'columns') {
      return;
    }

    const next = new Set(this.expandedNodeIds());
    if (next.has(nodeId)) {
      next.delete(nodeId);
    } else {
      next.add(nodeId);
    }
    this.expandedNodeIds.set(next);
  }

  protected onNodeDoubleClick(nodeId: string, event: Event): void {
    event.stopPropagation();
    if (this.viewMode() === 'columns') {
      return;
    }

    const next = new Set(this.expandedNodeIds());
    next.add(nodeId);
    this.expandedNodeIds.set(next);
  }

  protected hasColumnFocus(): boolean {
    return this.selectedColumn() !== null;
  }

  protected isNodeDimmed(nodeId: string): boolean {
    if (this.hasColumnFocus()) {
      return !this.columnLineageNodeIds().has(nodeId);
    }

    if (this.graphMode() !== 'full') {
      return false;
    }
    const related = this.relatedNodeIds();
    if (!related) {
      return false;
    }
    return !related.has(nodeId);
  }

  protected isEdgeDimmed(edge: LineageEdge): boolean {
    if (this.hasColumnFocus() || this.viewMode() === 'columns') {
      return true;
    }

    if (this.graphMode() !== 'full') {
      return false;
    }
    const related = this.relatedNodeIds();
    if (!related) {
      return false;
    }
    return !isEdgeInSubgraph(edge, related);
  }

  protected isColumnDimmed(nodeId: string, columnName: string): boolean {
    if (!this.hasColumnFocus()) {
      return false;
    }
    return !this.columnHighlight().columnKeys.has(columnRefKey(nodeId, columnName));
  }

  protected isColumnEdgeDimmed(edgeKey: string): boolean {
    if (!this.hasColumnFocus()) {
      return false;
    }
    return !this.columnHighlight().edgeKeys.has(edgeKey);
  }

  protected isEdgeHighlighted(edge: LineageEdge): boolean {
    const nodeId = this.selectedNodeId();
    if (!nodeId) {
      return false;
    }
    return edge.source === nodeId || edge.target === nodeId;
  }

  protected setGraphMode(mode: LineageGraphMode): void {
    this.graphModeChange.emit(mode);
  }

  protected decreaseHopDepth(): void {
    if (!this.canDecreaseHopDepth()) {
      return;
    }

    const current = this.hopDepth();
    if (current === UNLIMITED_HOP_DEPTH) {
      const nodeId = this.selectedNodeId();
      if (!nodeId) {
        return;
      }
      this.hopDepthChange.emit(computeMaxHopDepth(nodeId, this.edges()));
      return;
    }

    this.hopDepthChange.emit(current - 1);
  }

  protected increaseHopDepth(): void {
    if (!this.canIncreaseHopDepth()) {
      return;
    }
    this.hopDepthChange.emit(this.hopDepth() + 1);
  }

  protected setUnlimitedHopDepth(): void {
    if (!this.hopDepthControlsEnabled()) {
      return;
    }
    this.hopDepthChange.emit(UNLIMITED_HOP_DEPTH);
  }

  protected selectNode(nodeId: string, event?: Event): void {
    event?.stopPropagation();
    this.nodeSelected.emit(nodeId);
  }

  protected selectColumn(nodeId: string, columnName: string, event: Event): void {
    event.stopPropagation();

    if (this.viewMode() === 'models' && !this.isNodeExpanded(nodeId)) {
      const next = new Set(this.expandedNodeIds());
      next.add(nodeId);
      this.expandedNodeIds.set(next);
    }

    this.columnSelected.emit({ nodeId, columnName });
  }

  protected onNodeBodyPointerUp(nodeId: string, event: PointerEvent): void {
    const target = event.target as Element;
    if (target.closest('.lineage-graph__column-row')) {
      return;
    }
    event.stopPropagation();
    this.selectNode(nodeId, event);
  }

  protected isColumnPathHighlighted(nodeId: string, columnName: string): boolean {
    if (!this.hasColumnFocus() || this.isColumnSelected(nodeId, columnName)) {
      return false;
    }

    return this.columnHighlight().columnKeys.has(columnRefKey(nodeId, columnName));
  }

  protected isColumnSelected(nodeId: string, columnName: string): boolean {
    const selected = this.selectedColumn();
    return (
      !!selected &&
      selected.nodeId === nodeId &&
      selected.columnName === columnName
    );
  }

  protected isColumnEdgeHighlighted(edgeKey: string): boolean {
    const highlight = this.columnHighlight();
    return highlight.edgeKeys.has(edgeKey);
  }

  protected setViewMode(mode: LineageViewMode): void {
    this.viewModeChange.emit(mode);
  }

  protected onNodePointerDown(nodeId: string, event: PointerEvent): void {
    const target = event.target as Element;
    // Drag from the whole node header (grip + title). Expand / columns stay click-only.
    if (
      !target.closest('.lineage-graph__node-header') ||
      target.closest('.lineage-graph__expand-btn') ||
      target.closest('.lineage-graph__column-row')
    ) {
      return;
    }

    const pos = this.positions().get(nodeId);
    if (!pos) {
      return;
    }

    event.stopPropagation();
    this.dragNodeId = nodeId;
    this.dragPointerId = event.pointerId;
    this.dragMoved = false;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.dragStartNodeX = pos.x;
    this.dragStartNodeY = pos.y;
    this.lastPointerClientX = event.clientX;
    this.lastPointerClientY = event.clientY;
    this.draggingNodeId.set(nodeId);
    const canvas = this.canvasRef()?.nativeElement;
    canvas?.setPointerCapture(event.pointerId);
    this.startAutoPanLoop();
  }

  protected onNodePointerUp(nodeId: string, event: PointerEvent): void {
    const target = event.target as Element;
    // With pointer capture on the canvas, click-vs-drag selection is handled in
    // onCanvasPointerUp. This is a fallback when capture is unavailable.
    if (this.dragNodeId !== nodeId) {
      if (
        target.closest('.lineage-graph__expand-btn') ||
        target.closest('.lineage-graph__column-row')
      ) {
        return;
      }
      if (target.closest('.lineage-graph__node-header')) {
        event.stopPropagation();
        this.selectNode(nodeId, event);
      }
      return;
    }

    const wasDrag = this.dragMoved;
    this.endNodeDrag(event);

    if (
      wasDrag ||
      target.closest('.lineage-graph__expand-btn') ||
      target.closest('.lineage-graph__column-row')
    ) {
      return;
    }

    event.stopPropagation();
    this.selectNode(nodeId, event);
  }

  protected onColumnPointerDown(event: PointerEvent): void {
    event.stopPropagation();
  }

  protected onColumnPointerUp(nodeId: string, columnName: string, event: PointerEvent): void {
    event.stopPropagation();
    this.selectColumn(nodeId, columnName, event);
  }

  protected onCanvasPointerDown(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    if (
      target.closest('.lineage-graph__node-header') ||
      target.closest('.lineage-graph__node-body') ||
      target.closest('.lineage-graph__column-row')
    ) {
      return;
    }

    this.isPanning.set(true);
    this.canvasPointerStartX = event.clientX;
    this.canvasPointerStartY = event.clientY;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panOriginX = this.panX();
    this.panOriginY = this.panY();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }

  protected onCanvasPointerMove(event: PointerEvent): void {
    if (this.dragNodeId) {
      this.updateNodeDrag(event);
      return;
    }

    if (!this.isPanning()) {
      return;
    }

    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    this.panX.set(this.panOriginX + dx);
    this.panY.set(this.panOriginY + dy);
  }

  protected onCanvasPointerUp(event: PointerEvent): void {
    if (this.dragNodeId) {
      const nodeId = this.dragNodeId;
      const wasDrag = this.dragMoved;
      this.endNodeDrag(event);
      // Pointer capture retargets pointerup to the canvas, so treat a
      // no-movement header press as a node click here.
      if (!wasDrag) {
        this.selectNode(nodeId, event);
      }
      return;
    }

    if (!this.isPanning()) {
      return;
    }

    const dx = event.clientX - this.canvasPointerStartX;
    const dy = event.clientY - this.canvasPointerStartY;
    const wasCanvasClick =
      Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX;

    this.isPanning.set(false);
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);

    if (wasCanvasClick && this.hasColumnFocus()) {
      this.columnSelectionCleared.emit();
    }

    if (wasCanvasClick) {
      const now = Date.now();
      if (now - this.lastCanvasClickAt < 400) {
        this.nodeSelectionCleared.emit();
      }
      this.lastCanvasClickAt = now;
    }
  }

  protected columnRowHeight(): number {
    return LINEAGE_COLUMN_ROW_HEIGHT;
  }

  protected reorganizeLayout(): void {
    const nodes = this.displayNodes();
    const viewMode = this.effectiveViewMode();
    const layoutExpanded =
      viewMode === 'columns'
        ? new Set(nodes.map((node) => node.id))
        : new Set(this.expandedNodeIds());
    this.layoutExpandedNodeIds.set(layoutExpanded);
    this.customPositions.set(new Map());
    this.layoutRevision.update((revision) => revision + 1);
    this.isReorganizing.set(true);
    this.scheduleFitToView();
    window.setTimeout(() => this.isReorganizing.set(false), REORGANIZE_TRANSITION_MS);
  }

  private applyExpandedHeights(
    positions: Map<string, LineageNodePosition>,
    nodes: LineageNode[],
    expandedIds: ReadonlySet<string>,
    viewMode: LineageViewMode,
  ): Map<string, LineageNodePosition> {
    if (viewMode === 'columns') {
      return positions;
    }

    const result = new Map(positions);
    for (const node of nodes) {
      if (!expandedIds.has(node.id) || !node.columns?.length) {
        continue;
      }
      const pos = result.get(node.id);
      if (pos) {
        result.set(node.id, { ...pos, height: getExpandedNodeHeight(node) });
      }
    }
    return result;
  }

  protected onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom() + delta));
    this.zoom.set(next);
  }

  protected zoomIn(): void {
    this.zoom.set(Math.min(MAX_ZOOM, this.zoom() + 0.15));
  }

  protected zoomOut(): void {
    this.zoom.set(Math.max(MIN_ZOOM, this.zoom() - 0.15));
  }

  protected resetView(): void {
    this.fitToView();
  }

  private updateNodeDrag(event: PointerEvent): void {
    if (!this.dragNodeId) {
      return;
    }

    const dx = (event.clientX - this.dragStartClientX) / this.zoom();
    const dy = (event.clientY - this.dragStartClientY) / this.zoom();

    if (
      !this.dragMoved &&
      (Math.abs(event.clientX - this.dragStartClientX) > DRAG_THRESHOLD_PX ||
        Math.abs(event.clientY - this.dragStartClientY) > DRAG_THRESHOLD_PX)
    ) {
      this.dragMoved = true;
    }

    this.lastPointerClientX = event.clientX;
    this.lastPointerClientY = event.clientY;

    // Rebase the anchor to the position/pointer just applied (rather than the
    // original mousedown point) so auto-pan ticks — which also advance the
    // node and rebase — compose correctly instead of double-counting motion.
    this.setDraggedNodePosition(this.dragStartNodeX + dx, this.dragStartNodeY + dy);
    this.dragStartNodeX += dx;
    this.dragStartNodeY += dy;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
  }

  private setDraggedNodePosition(x: number, y: number): void {
    if (!this.dragNodeId) {
      return;
    }
    const next = new Map(this.customPositions());
    next.set(this.dragNodeId, { x: this.snapToGrid(x), y: this.snapToGrid(y) });
    this.customPositions.set(next);
  }

  /**
   * Runs for the lifetime of a node drag. While the pointer sits near (or
   * beyond) an edge of the canvas it can't physically move past, this keeps
   * panning the view — and advancing the dragged node with it — every frame
   * so the drag never stalls, regardless of direction.
   */
  private startAutoPanLoop(): void {
    if (this.autoPanRafId !== null) {
      return;
    }
    const step = (): void => {
      if (!this.dragNodeId) {
        this.autoPanRafId = null;
        return;
      }
      this.applyEdgeAutoPan();
      this.autoPanRafId = requestAnimationFrame(step);
    };
    this.autoPanRafId = requestAnimationFrame(step);
  }

  private stopAutoPanLoop(): void {
    if (this.autoPanRafId !== null) {
      cancelAnimationFrame(this.autoPanRafId);
      this.autoPanRafId = null;
    }
  }

  private applyEdgeAutoPan(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas || !this.dragNodeId) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const vx = edgeAutoPanVelocity(this.lastPointerClientX, rect.left, rect.right);
    const vy = edgeAutoPanVelocity(this.lastPointerClientY, rect.top, rect.bottom);
    if (vx === 0 && vy === 0) {
      return;
    }

    this.panX.update((x) => x - vx);
    this.panY.update((y) => y - vy);

    const zoom = this.zoom();
    const nextX = this.dragStartNodeX + vx / zoom;
    const nextY = this.dragStartNodeY + vy / zoom;
    this.setDraggedNodePosition(nextX, nextY);
    this.dragStartNodeX = nextX;
    this.dragStartNodeY = nextY;
    this.dragMoved = true;
  }

  private endNodeDrag(event: PointerEvent): void {
    if (this.dragPointerId !== null) {
      const canvas = this.canvasRef()?.nativeElement;
      try {
        canvas?.releasePointerCapture(this.dragPointerId);
      } catch {
        // capture may already be released
      }
    }

    this.stopAutoPanLoop();
    this.draggingNodeId.set(null);
    this.dragNodeId = null;
    this.dragPointerId = null;

    if (!this.dragMoved) {
      return;
    }

    window.setTimeout(() => {
      this.dragMoved = false;
    }, 0);
  }

  private snapToGrid(value: number): number {
    return Math.round(value / SNAP_GRID) * SNAP_GRID;
  }

  protected headerHeight(): number {
    return LINEAGE_NODE_HEADER_HEIGHT;
  }

  protected columnTransformation(node: LineageNode, column: LineageColumn): ColumnTransformationType {
    return inferColumnTransformation(node, column, this.columnEdges(), this.nodes());
  }

  protected isColumnFilteredOut(node: LineageNode, column: LineageColumn): boolean {
    const filter = this.transformationFilter();
    if (!filter) {
      return false;
    }
    return this.columnTransformation(node, column) !== filter;
  }

  protected transformationChipText(type: ColumnTransformationType): string {
    return transformationChipLabel(type, this.transformationChipMode());
  }

  protected transformationChipTitle(type: ColumnTransformationType): string {
    return transformationDescription(type);
  }

  protected transformChipFill(type: ColumnTransformationType): string {
    return transformationCssVar(type, 'bg');
  }

  protected transformChipStroke(type: ColumnTransformationType): string {
    return transformationCssVar(type, 'border');
  }

  protected transformChipTextFill(type: ColumnTransformationType): string {
    return transformationCssVar(type, 'text');
  }

  protected columnTypeX(nodeWidth: number, transformType: ColumnTransformationType): number {
    return nodeWidth - 10 - transformationChipWidth(transformType, this.transformationChipMode()) - 6;
  }

  protected transformChipX(nodeWidth: number, transformType: ColumnTransformationType): number {
    return nodeWidth - 8 - transformationChipWidth(transformType, this.transformationChipMode());
  }

  protected transformChipW(type: ColumnTransformationType): number {
    return transformationChipWidth(type, this.transformationChipMode());
  }

  protected transformChipH(): number {
    return 18;
  }

  protected setTransformationChipMode(mode: TransformationChipMode): void {
    this.transformationChipMode.set(mode);
  }

  protected setTransformationFilter(type: ColumnTransformationType | null): void {
    this.transformationFilter.set(type);
  }

  private scheduleCenterOnNode(nodeId: string): void {
    queueMicrotask(() => {
      requestAnimationFrame(() => this.centerOnNode(nodeId));
    });
  }

  private centerOnNode(nodeId: string): void {
    const canvas = this.canvasRef()?.nativeElement;
    const pos = this.positions().get(nodeId);
    if (!canvas || !pos) {
      return;
    }

    const zoom = this.zoom();
    const bounds = this.bounds();
    // The SVG viewBox is offset by bounds().minX/minY (so dragged nodes with
    // negative coordinates stay visible), so node positions must be
    // translated into that local space before computing pan offsets.
    const centerX = pos.x - bounds.minX + pos.width / 2;
    const centerY = pos.y - bounds.minY + pos.height / 2;
    const viewCenterX = canvas.clientWidth / 2;
    const viewCenterY = canvas.clientHeight / 2;

    this.panX.set(viewCenterX - centerX * zoom);
    this.panY.set(viewCenterY - centerY * zoom);
  }

  private fitToView(): void {
    const canvas = this.canvasRef()?.nativeElement;
    if (!canvas) {
      return;
    }

    const { width, height } = this.bounds();
    const availableWidth = canvas.clientWidth - 32;
    const availableHeight = canvas.clientHeight - 32;

    if (availableWidth <= 0 || availableHeight <= 0 || width <= 0 || height <= 0) {
      return;
    }

    const scale = Math.min(availableWidth / width, availableHeight / height, 1);
    this.zoom.set(scale);
    this.panX.set((availableWidth - width * scale) / 2 + 16);
    this.panY.set((availableHeight - height * scale) / 2 + 16);
  }
}
