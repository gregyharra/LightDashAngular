import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { DbtTreeNode } from '../../../core/models/lineage.model';
import {
  collectSelectableNodes,
  filterTreeNodes,
  findAncestorFolderPaths,
  flattenVisibleTree,
  getDefaultExpandedPaths,
} from '../dbt-tree-utils';

@Component({
  selector: 'app-folder-search-panel',
  imports: [FormsModule, MatIconModule],
  templateUrl: './folder-search-panel.component.html',
  styleUrl: './folder-search-panel.component.scss',
})
export class FolderSearchPanelComponent {
  readonly tree = input.required<DbtTreeNode[]>();
  readonly selectedNodeId = input<string | null>(null);

  readonly nodeSelected = output<string>();
  readonly searchEnter = output<string>();

  private readonly treeNavRef = viewChild<ElementRef<HTMLElement>>('treeNav');

  protected readonly searchQuery = signal('');
  protected readonly expandedPaths = signal<Set<string>>(new Set());

  protected readonly filteredTree = computed(() =>
    filterTreeNodes(this.tree(), this.searchQuery()),
  );

  protected readonly visibleItems = computed(() =>
    flattenVisibleTree(this.filteredTree(), this.expandedPaths()),
  );

  protected readonly matchCount = computed(() =>
    collectSelectableNodes(this.filteredTree()).length,
  );

  constructor() {
    effect(() => {
      const tree = this.tree();
      if (tree.length > 0) {
        this.expandedPaths.set(getDefaultExpandedPaths(tree));
      }
    });

    effect(() => {
      const query = this.searchQuery().trim();
      if (query) {
        this.expandedPaths.set(getDefaultExpandedPaths(this.filteredTree()));
      }
    });

    effect(() => {
      const selectedId = this.selectedNodeId();
      const tree = this.tree();
      if (!selectedId || tree.length === 0) {
        return;
      }

      const folderPaths = findAncestorFolderPaths(tree, selectedId);
      if (folderPaths.length > 0) {
        const current = this.expandedPaths();
        const hasMissingPath = folderPaths.some((path) => !current.has(path));
        if (hasMissingPath) {
          const next = new Set(current);
          for (const path of folderPaths) {
            next.add(path);
          }
          this.expandedPaths.set(next);
        }
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

  protected toggleFolder(path: string, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.expandedPaths());
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    this.expandedPaths.set(next);
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

  protected iconForType(type: DbtTreeNode['type']): string {
    switch (type) {
      case 'folder':
        return 'folder';
      case 'model':
        return 'table_chart';
      case 'seed':
        return 'grass';
      case 'source':
        return 'input';
      case 'sources_file':
        return 'description';
      default:
        return 'insert_drive_file';
    }
  }
}
