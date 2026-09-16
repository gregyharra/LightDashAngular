import { DbtTreeNode } from '../../core/models/lineage.model';
import { ExploreSummary } from '../../core/models/explore.model';

function folder(name: string, path: string, children: DbtTreeNode[]): DbtTreeNode {
  return { id: path, name, path, type: 'folder', children };
}

function exploreLeaf(explore: ExploreSummary): DbtTreeNode {
  const group = explore.tags[0] ?? 'general';
  const path = `explores/${explore.schemaName}/${group}/${explore.name}`;

  return {
    id: path,
    name: explore.label,
    path,
    type: 'model',
    lineageNodeId: explore.name,
    description: explore.description,
  };
}

function formatGroupLabel(tag: string): string {
  if (!tag) {
    return 'General';
  }

  return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/_/g, ' ');
}

export function buildExploreTree(explores: ExploreSummary[]): DbtTreeNode[] {
  const schemaMap = new Map<string, Map<string, ExploreSummary[]>>();

  for (const explore of explores) {
    const schema = explore.schemaName;
    const group = explore.tags[0] ?? 'general';

    if (!schemaMap.has(schema)) {
      schemaMap.set(schema, new Map());
    }

    const groupMap = schemaMap.get(schema)!;
    if (!groupMap.has(group)) {
      groupMap.set(group, []);
    }

    groupMap.get(group)!.push(explore);
  }

  const schemaFolders = [...schemaMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([schema, groupMap]) => {
      const groupFolders = [...groupMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([group, items]) =>
          folder(
            formatGroupLabel(group),
            `explores/${schema}/${group}`,
            [...items]
              .sort((left, right) => left.label.localeCompare(right.label))
              .map(exploreLeaf),
          ),
        );

      return folder(schema, `explores/${schema}`, groupFolders);
    });

  return [folder('Explores', 'explores', schemaFolders)];
}
