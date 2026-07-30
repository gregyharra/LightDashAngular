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
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DbtTreeNode, LineageNode } from '../../../core/models/lineage.model';
import {
  buildSchemaGroupedTree,
  collectSelectableNodes,
  countSelectableDescendants,
  filterTreeNodes,
  findAncestorFolderPaths,
  flattenVisibleTree,
  getDefaultExpandedPaths,
  iconForDbtTreeType,
} from '../dbt-tree-utils';

@Component({
  selector: 'app-folder-search-panel',
  host: {
    class: 'folder-panel-host',
  },
  imports: [FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './folder-search-panel.component.html',
  styleUrl: './folder-search-panel.component.scss',
})
export class FolderSearchPanelComponent {
  private static readonly DEFAULT_WIDTH = 280;
  private static readonly MIN_WIDTH = 200;
  private static readonly MAX_WIDTH = 480;
  protected static readonly COLLAPSED_WIDTH = 44;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly renderer = inject(Renderer2);
  private readonly destroyRef = inject(DestroyRef);

  readonly tree = input.required<DbtTreeNode[]>();
  readonly selectedNodeId = input<string | null>(null);
  readonly projectUuid = input<string | null>(null);
  readonly lineageNodes = input<LineageNode[]>([]);
  readonly title = input('Project');
  readonly searchPlaceholder = input('Search models…');
  readonly emptyMessage = input('No models match your search');
  readonly collapsedStorageKey = input('lightdash-lineage-folder-panel-collapsed');
  readonly treeAriaLabel = input('dbt project folder tree');
  readonly resizable = input(true);

  readonly nodeSelected = output<string>();
  readonly searchEnter = output<string>();

  private readonly treeNavRef = viewChild<ElementRef<HTMLElement>>('treeNav');

  protected readonly collapsed = signal(false);
  protected readonly panelWidth = signal(FolderSearchPanelComponent.DEFAULT_WIDTH);
  protected readonly resizing = signal(false);
  protected readonly searchQuery = signal('');
  protected readonly expandedPaths = signal<Set<string>>(new Set());
  protected readonly treeViewMode = signal<'folder' | 'schema'>('folder');

  /** Last selection id for which we auto-expanded ancestor folders. */
  private lastRevealedSelectedId: string | null = null;

  private isDragging = false;
  private startX = 0;
  private startWidth = 0;
  private unlistenMove?: () => void;
  private unlistenUp?: () => void;

  protected readonly collapsedWidth = FolderSearchPanelComponent.COLLAPSED_WIDTH;

  private readonly schemaByLineageNodeId = computed(() => {
    const map = new Map<string, string>();
    for (const node of this.lineageNodes()) {
      map.set(node.id, node.schema ?? '');
    }
    return map;
  });

  private readonly activeTree = computed(() => {
    if (this.treeViewMode() === 'schema') {
      return buildSchemaGroupedTree(this.tree(), this.schemaByLineageNodeId());
    }
    return this.tree();
  });

  protected readonly filteredTree = computed(() =>
    filterTreeNodes(this.activeTree(), this.searchQuery()),
  );

  protected readonly visibleItems = computed(() =>
    flattenVisibleTree(this.filteredTree(), this.expandedPaths()),
  );

  protected readonly matchCount = computed(() =>
    collectSelectableNodes(this.filteredTree()).length,
  );

  constructor() {
    this.collapsed.set(this.readCollapsedState());
    this.treeViewMode.set(this.readTreeViewMode());
    if (isPlatformBrowser(this.platformId)) {
      this.panelWidth.set(this.readSavedWidth());
    }

    this.destroyRef.onDestroy(() => {
      this.stopResize();
    });

    effect(() => {
      const projectUuid = this.projectUuid();
      if (projectUuid) {
        this.treeViewMode.set(this.readTreeViewMode());
      }
    });

    effect(() => {
      const tree = this.activeTree();
      const projectUuid = this.projectUuid();
      if (tree.length === 0) {
        return;
      }
      // Re-read when project changes.
      projectUuid;
      const saved = this.readExpandedPaths();
      this.expandedPaths.set(saved ?? getDefaultExpandedPaths(tree));
    });

    effect(() => {
      const query = this.searchQuery().trim();
      if (query) {
        this.expandedPaths.set(getDefaultExpandedPaths(this.filteredTree()));
      }
    });

    effect(() => {
      const selectedId = this.selectedNodeId();
      if (!selectedId) {
        this.lastRevealedSelectedId = null;
        return;
      }

      // Only auto-reveal on selection change — not when the user collapses a folder
      // (which would otherwise re-trigger via expandedPaths) or on unrelated CD cycles.
      if (selectedId === this.lastRevealedSelectedId) {
        return;
      }

      const tree = this.activeTree();
      if (tree.length === 0) {
        return;
      }

      this.lastRevealedSelectedId = selectedId;

      const folderPaths = findAncestorFolderPaths(tree, selectedId);
      if (folderPaths.length > 0) {
        untracked(() => {
          const current = this.expandedPaths();
          const hasMissingPath = folderPaths.some((path) => !current.has(path));
          if (hasMissingPath) {
            const next = new Set(current);
            for (const path of folderPaths) {
              next.add(path);
            }
            this.expandedPaths.set(next);
            this.persistExpandedPaths(next);
          }
        });
      }

      queueMicrotask(() => {
        requestAnimationFrame(() => {
          const nav = this.treeNavRef()?.nativeElement;
          const selectedItem = nav?.querySelector('.folder-panel__item--selected');
          selectedItem?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      });
    });
  }

  protected setTreeViewMode(mode: 'folder' | 'schema'): void {
    if (this.treeViewMode() === mode) {
      return;
    }
    this.treeViewMode.set(mode);
    this.persistTreeViewMode(mode);
    // Reset expand set for the new tree shape (prefer saved for this mode if present).
    const saved = this.readExpandedPaths();
    this.expandedPaths.set(saved ?? getDefaultExpandedPaths(this.activeTree()));
    this.persistExpandedPaths(this.expandedPaths());
  }

  protected onSearchInput(value: string): void {
    this.searchQuery.set(value);
  }

  protected onSearchKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    const matches = collectSelectableNodes(this.filteredTree());
    if (matches.length > 0 && matches[0].lineageNodeId) {
      this.nodeSelected.emit(matches[0].lineageNodeId);
      this.searchEnter.emit(matches[0].lineageNodeId);
    }
  }

  protected toggleCollapsed(): void {
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.collapsedStorageKey(), String(next));
    }
  }

  protected onResizeStart(event: PointerEvent): void {
    if (!this.resizable() || this.collapsed()) {
      return;
    }

    const handle = event.currentTarget as HTMLElement;
    event.preventDefault();
    this.isDragging = true;
    this.resizing.set(true);
    this.startX = event.clientX;
    this.startWidth = this.panelWidth();
    handle.setPointerCapture(event.pointerId);
    this.renderer.addClass(document.body, 'folder-panel--resizing');

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

    const width = this.clamp(this.startWidth + (event.clientX - this.startX));
    this.panelWidth.set(width);
  }

  private onResizeEnd(event: PointerEvent, handle: HTMLElement): void {
    if (!this.isDragging) {
      return;
    }

    handle.releasePointerCapture(event.pointerId);
    this.stopResize();

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.getWidthStorageKey(), String(this.panelWidth()));
    }
  }

  private stopResize(): void {
    this.isDragging = false;
    this.resizing.set(false);
    this.renderer.removeClass(document.body, 'folder-panel--resizing');
    this.unlistenMove?.();
    this.unlistenUp?.();
    this.unlistenMove = undefined;
    this.unlistenUp = undefined;
  }

  protected toggleFolder(path: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.expandedPaths());
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    this.expandedPaths.set(next);
    this.persistExpandedPaths(next);
  }

  private viewModeStorageKey(): string | null {
    const projectUuid = this.projectUuid();
    if (!projectUuid || !isPlatformBrowser(this.platformId)) {
      return null;
    }
    return `${this.collapsedStorageKey()}:tree-view:${projectUuid}`;
  }

  private expandedStorageKey(): string | null {
    const projectUuid = this.projectUuid();
    if (!projectUuid || !isPlatformBrowser(this.platformId)) {
      return null;
    }
    return `${this.collapsedStorageKey()}:expanded:${projectUuid}`;
  }

  private readTreeViewMode(): 'folder' | 'schema' {
    const key = this.viewModeStorageKey();
    if (!key) {
      return 'folder';
    }
    const raw = localStorage.getItem(key);
    return raw === 'schema' ? 'schema' : 'folder';
  }

  private persistTreeViewMode(mode: 'folder' | 'schema'): void {
    const key = this.viewModeStorageKey();
    if (!key) {
      return;
    }
    localStorage.setItem(key, mode);
  }

  private readExpandedPaths(): Set<string> | null {
    const key = this.expandedStorageKey();
    if (!key) {
      return null;
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || !parsed.every((p) => typeof p === 'string')) {
        return null;
      }
      return new Set(parsed);
    } catch {
      return null;
    }
  }

  private persistExpandedPaths(paths: Set<string>): void {
    const key = this.expandedStorageKey();
    if (!key) {
      return;
    }
    localStorage.setItem(key, JSON.stringify([...paths]));
  }

  protected selectItem(item: DbtTreeNode, event: Event): void {
    event.stopPropagation();
    if (!item.lineageNodeId) {
      return;
    }
    this.nodeSelected.emit(item.lineageNodeId);
  }

  protected isSelected(item: DbtTreeNode): boolean {
    return !!item.lineageNodeId && item.lineageNodeId === this.selectedNodeId();
  }

  private readCollapsedState(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return localStorage.getItem(this.collapsedStorageKey()) === 'true';
  }

  private getWidthStorageKey(): string {
    return `${this.collapsedStorageKey()}-width`;
  }

  private readSavedWidth(): number {
    const saved = localStorage.getItem(this.getWidthStorageKey());
    const parsed = saved ? Number.parseInt(saved, 10) : Number.NaN;
    return Number.isFinite(parsed)
      ? this.clamp(parsed)
      : FolderSearchPanelComponent.DEFAULT_WIDTH;
  }

  private clamp(width: number): number {
    return Math.min(
      FolderSearchPanelComponent.MAX_WIDTH,
      Math.max(FolderSearchPanelComponent.MIN_WIDTH, width),
    );
  }

  protected iconForType(type: DbtTreeNode['type']): string {
    return iconForDbtTreeType(type);
  }

  protected leafCount(node: DbtTreeNode): number {
    return countSelectableDescendants(node);
  }

  protected showLeafCount(node: DbtTreeNode): boolean {
    return node.type === 'folder' || !!(node.children?.length);
  }
}
