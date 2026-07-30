import { DbtTreeNode } from '../../core/models/lineage.model';
import {
  countSelectableDescendants,
  filterTreeNodes,
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
