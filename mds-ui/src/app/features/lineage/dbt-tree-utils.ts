import { DbtTreeNode } from '../../core/models/lineage.model';

export interface FlatDbtTreeItem {
  node: DbtTreeNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export function collectSelectableNodes(nodes: DbtTreeNode[]): DbtTreeNode[] {
  const results: DbtTreeNode[] = [];

  const visit = (items: DbtTreeNode[]): void => {
    for (const item of items) {
      if (item.lineageNodeId) {
        results.push(item);
      }
      if (item.children?.length) {
        visit(item.children);
      }
    }
  };

  visit(nodes);
  return results;
}

export function findTreeNodeByLineageId(
  nodes: DbtTreeNode[],
  lineageNodeId: string,
): DbtTreeNode | null {
  for (const node of nodes) {
    if (node.lineageNodeId === lineageNodeId) {
      return node;
    }
    if (node.children?.length) {
      const found = findTreeNodeByLineageId(node.children, lineageNodeId);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function findAncestorFolderPaths(nodes: DbtTreeNode[], lineageNodeId: string): string[] {
  const paths: string[] = [];

  const visit = (items: DbtTreeNode[], ancestors: string[]): boolean => {
    for (const item of items) {
      const nextAncestors = item.type === 'folder' ? [...ancestors, item.path] : ancestors;
      if (item.lineageNodeId === lineageNodeId) {
        paths.push(...nextAncestors);
        return true;
      }
      if (item.children?.length && visit(item.children, nextAncestors)) {
        return true;
      }
    }
    return false;
  };

  visit(nodes, []);
  return paths;
}

export function filterTreeNodes(nodes: DbtTreeNode[], query: string): DbtTreeNode[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return nodes;
  }

  const filterNode = (node: DbtTreeNode): DbtTreeNode | null => {
    const nameMatch = node.name.toLowerCase().includes(normalized);
    const pathMatch = node.path.toLowerCase().includes(normalized);
    const descMatch = node.description?.toLowerCase().includes(normalized);
    const selfMatch = !!(nameMatch || pathMatch || descMatch);

    const filteredChildren = (node.children ?? [])
      .map(filterNode)
      .filter((child): child is DbtTreeNode => child !== null);

    if (selfMatch || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren.length > 0 ? filteredChildren : node.children,
      };
    }

    return null;
  };

  return nodes
    .map(filterNode)
    .filter((node): node is DbtTreeNode => node !== null);
}

export function flattenVisibleTree(
  nodes: DbtTreeNode[],
  expandedPaths: Set<string>,
  depth = 0,
): FlatDbtTreeItem[] {
  const items: FlatDbtTreeItem[] = [];

  for (const node of nodes) {
    const hasChildren = !!(node.children?.length);
    const expanded = hasChildren && expandedPaths.has(node.path);

    items.push({ node, depth, hasChildren, expanded });

    if (expanded && node.children?.length) {
      items.push(...flattenVisibleTree(node.children, expandedPaths, depth + 1));
    }
  }

  return items;
}

export function getDefaultExpandedPaths(nodes: DbtTreeNode[]): Set<string> {
  const paths = new Set<string>();

  const visit = (items: DbtTreeNode[]): void => {
    for (const item of items) {
      if (item.type === 'folder') {
        paths.add(item.path);
      }
      if (item.children?.length) {
        visit(item.children);
      }
    }
  };

  visit(nodes);
  return paths;
}
