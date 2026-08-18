import { LineageNode } from '../../core/models/lineage.model';

export function explorePath(projectUuid: string, tableId: string): string[] {
  return ['/projects', projectUuid, 'explore', tableId];
}

export function exploreRootPath(projectUuid: string): string[] {
  return ['/projects', projectUuid, 'explore'];
}

export function isExploreableLineageNode(node: LineageNode): boolean {
  return (
    node.type === 'source' ||
    node.type === 'seed' ||
    node.type === 'staging' ||
    node.type === 'intermediate' ||
    node.type === 'mart'
  );
}
