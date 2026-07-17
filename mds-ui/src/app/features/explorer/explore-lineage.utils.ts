import { DbtTreeNode } from '../../core/models/lineage.model';
import { ExploreSummary } from '../../core/models/explore.model';

export function findExploreForLineageNode(
  explores: ExploreSummary[],
  lineageNodeId: string,
  treeNode?: DbtTreeNode | null,
): ExploreSummary | undefined {
  const matches = explores.filter(
    (explore) => explore.lineageNodeId === lineageNodeId,
  );
  if (matches.length === 0) {
    return undefined;
  }
  if (matches.length === 1) {
    return matches[0];
  }

  const modelName = treeNode?.name;
  if (modelName) {
    const byModelName = matches.find((explore) => explore.name === modelName);
    if (byModelName) {
      return byModelName;
    }
  }

  return [...matches].sort((left, right) =>
    left.label.localeCompare(right.label),
  )[0];
}

export function findExploreByName(
  explores: ExploreSummary[],
  name: string,
): ExploreSummary | undefined {
  return explores.find((explore) => explore.name === name);
}
