import { DbtTreeNode } from '../../core/models/lineage.model';
import {
  UNSPECIFIED_SCHEMA_LABEL,
  buildSchemaGroupedTree,
  countSelectableDescendants,
  filterTreeNodes,
  findAncestorFolderPaths,
  iconForDbtTreeType,
} from './dbt-tree-utils';

function folder(name: string, children: DbtTreeNode[], path = name): DbtTreeNode {
  return { id: `folder:${path}`, name, path, type: 'folder', children };
}

function leaf(
  name: string,
  lineageNodeId: string,
  type: DbtTreeNode['type'] = 'model',
): DbtTreeNode {
  return {
    id: lineageNodeId,
    name,
    path: `models/${name}.sql`,
    type,
    lineageNodeId,
  };
}

describe('countSelectableDescendants', () => {
  it('counts selectable leaves under a folder, not the folder itself', () => {
    const tree = folder('models', [
      folder('staging', [leaf('stg_orders', 'model.j.stg_orders')], 'models/staging'),
      leaf('fct_orders', 'model.j.fct_orders'),
    ], 'models');

    expect(countSelectableDescendants(tree)).toBe(2);
    expect(countSelectableDescendants(tree.children![0])).toBe(1);
  });

  it('returns 0 for a leaf without children', () => {
    expect(countSelectableDescendants(leaf('x', 'model.j.x'))).toBe(0);
  });

  it('counts after filterTreeNodes (filtered tree only)', () => {
    const tree = [
      folder('models', [
        leaf('stg_orders', 'model.j.stg_orders'),
        leaf('fct_orders', 'model.j.fct_orders'),
      ], 'models'),
    ];
    const filtered = filterTreeNodes(tree, 'stg');
    expect(countSelectableDescendants(filtered[0])).toBe(1);
  });
});

describe('iconForDbtTreeType', () => {
  it('maps resource types to clearer Material icon names', () => {
    expect(iconForDbtTreeType('folder')).toBe('folder');
    expect(iconForDbtTreeType('model')).toBe('table_chart');
    expect(iconForDbtTreeType('seed')).toBe('eco');
    expect(iconForDbtTreeType('source')).toBe('storage');
    expect(iconForDbtTreeType('sources_file')).toBe('description');
  });
});

describe('buildSchemaGroupedTree', () => {
  const pathTree: DbtTreeNode[] = [
    {
      id: 'folder:models',
      name: 'models',
      path: 'models',
      type: 'folder',
      children: [
        {
          id: 'model.j.stg_orders',
          name: 'stg_orders',
          path: 'models/staging/stg_orders.sql',
          type: 'model',
          lineageNodeId: 'model.j.stg_orders',
        },
        {
          id: 'model.j.fct_orders',
          name: 'fct_orders',
          path: 'models/marts/fct_orders.sql',
          type: 'model',
          lineageNodeId: 'model.j.fct_orders',
        },
        {
          id: 'model.j.orphan',
          name: 'orphan',
          path: 'models/orphan.sql',
          type: 'model',
          lineageNodeId: 'model.j.orphan',
        },
      ],
    },
  ];

  const schemas = new Map<string, string>([
    ['model.j.stg_orders', 'staging'],
    ['model.j.fct_orders', 'marts'],
    ['model.j.orphan', ''],
  ]);

  it('groups leaves by warehouse schema and uses Unspecified for missing/empty', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    const names = grouped.map((n) => n.name).sort();
    expect(names).toEqual(['marts', 'staging', UNSPECIFIED_SCHEMA_LABEL].sort());

    const unspecified = grouped.find((n) => n.name === UNSPECIFIED_SCHEMA_LABEL)!;
    expect(unspecified.type).toBe('folder');
    expect(unspecified.path).toBe(`schema:${UNSPECIFIED_SCHEMA_LABEL}`);
    expect(unspecified.children!.map((c) => c.lineageNodeId)).toEqual(['model.j.orphan']);
  });

  it('preserves lineageNodeId selection on leaves', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    const marts = grouped.find((n) => n.name === 'marts')!;
    expect(marts.children![0].lineageNodeId).toBe('model.j.fct_orders');
  });

  it('keeps ancestors of filter matches visible', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    const filtered = filterTreeNodes(grouped, 'stg_orders');
    expect(filtered).toHaveSize(1);
    expect(filtered[0].name).toBe('staging');
    expect(filtered[0].children![0].lineageNodeId).toBe('model.j.stg_orders');
  });

  it('findAncestorFolderPaths works for schema groups', () => {
    const grouped = buildSchemaGroupedTree(pathTree, schemas);
    expect(findAncestorFolderPaths(grouped, 'model.j.fct_orders')).toEqual(['schema:marts']);
  });
});
