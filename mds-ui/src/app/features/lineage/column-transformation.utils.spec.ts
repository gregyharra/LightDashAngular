import { ColumnLineageEdge, LineageColumn, LineageNode } from '../../core/models/lineage.model';
import { inferColumnTransformation } from './column-transformation.utils';

function makeNode(id: string, type: LineageNode['type'], columns: LineageColumn[]): LineageNode {
  return {
    id,
    name: id,
    type,
    schema: 'schema',
    database: 'db',
    catalog: 'db',
    columnCount: columns.length,
    columns,
  };
}

describe('inferColumnTransformation', () => {
  const sourceNode = makeNode('source.raw', 'source', [
    { name: 'amount', type: 'decimal' },
    { name: 'tax_paid', type: 'decimal' },
  ]);

  it('returns the explicit column-level type when set', () => {
    const target = makeNode('model.target', 'mart', [
      { name: 'total', type: 'decimal', transformationType: 'aggregate' },
    ]);
    const result = inferColumnTransformation(target, target.columns![0], [], [sourceNode, target]);
    expect(result).toBe('aggregate');
  });

  it('infers "source" for columns on a source node with no incoming edges', () => {
    const result = inferColumnTransformation(sourceNode, sourceNode.columns![0], [], [sourceNode]);
    expect(result).toBe('source');
  });

  it('infers "derived" for columns on a non-source node with no incoming edges', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'literal_flag', type: 'boolean' }]);
    const result = inferColumnTransformation(target, target.columns![0], [], [sourceNode, target]);
    expect(result).toBe('derived');
  });

  it('trusts an explicit "aggregate" edge type across multiple incoming edges', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'total', type: 'decimal' }]);
    const edges: ColumnLineageEdge[] = [
      { sourceNodeId: sourceNode.id, sourceColumn: 'amount', targetNodeId: target.id, targetColumn: 'total', transformationType: 'aggregate' },
      { sourceNodeId: sourceNode.id, sourceColumn: 'tax_paid', targetNodeId: target.id, targetColumn: 'total', transformationType: 'aggregate' },
    ];
    const result = inferColumnTransformation(target, target.columns![0], edges, [sourceNode, target]);
    expect(result).toBe('aggregate');
  });

  it('trusts an explicit "coalesce" edge type across multiple incoming edges', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'contact', type: 'varchar' }]);
    const edges: ColumnLineageEdge[] = [
      { sourceNodeId: sourceNode.id, sourceColumn: 'amount', targetNodeId: target.id, targetColumn: 'contact', transformationType: 'coalesce' },
      { sourceNodeId: sourceNode.id, sourceColumn: 'tax_paid', targetNodeId: target.id, targetColumn: 'contact', transformationType: 'coalesce' },
    ];
    const result = inferColumnTransformation(target, target.columns![0], edges, [sourceNode, target]);
    expect(result).toBe('coalesce');
  });

  it('falls back to "derived" when multiple incoming edges carry no explicit type', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'combined', type: 'decimal' }]);
    const edges: ColumnLineageEdge[] = [
      { sourceNodeId: sourceNode.id, sourceColumn: 'amount', targetNodeId: target.id, targetColumn: 'combined' },
      { sourceNodeId: sourceNode.id, sourceColumn: 'tax_paid', targetNodeId: target.id, targetColumn: 'combined' },
    ];
    const result = inferColumnTransformation(target, target.columns![0], edges, [sourceNode, target]);
    expect(result).toBe('derived');
  });

  it('passes through a "join-key" edge type from the backend for a single incoming edge', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'customer_id', type: 'bigint' }]);
    const edges: ColumnLineageEdge[] = [
      { sourceNodeId: sourceNode.id, sourceColumn: 'customer_id', targetNodeId: target.id, targetColumn: 'customer_id', transformationType: 'join-key' },
    ];
    const result = inferColumnTransformation(target, target.columns![0], edges, [sourceNode, target]);
    expect(result).toBe('join-key');
  });

  it('infers "pass-through" for a same-name, same-type single edge with no explicit type', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'amount', type: 'decimal' }]);
    const edges: ColumnLineageEdge[] = [
      { sourceNodeId: sourceNode.id, sourceColumn: 'amount', targetNodeId: target.id, targetColumn: 'amount' },
    ];
    const result = inferColumnTransformation(target, target.columns![0], edges, [sourceNode, target]);
    expect(result).toBe('pass-through');
  });

  it('infers "rename" for a renamed single edge with no explicit type', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'renamed_amount', type: 'decimal' }]);
    const edges: ColumnLineageEdge[] = [
      { sourceNodeId: sourceNode.id, sourceColumn: 'amount', targetNodeId: target.id, targetColumn: 'renamed_amount' },
    ];
    const result = inferColumnTransformation(target, target.columns![0], edges, [sourceNode, target]);
    expect(result).toBe('rename');
  });

  it('infers "cast" for a same-name single edge whose type changed with no explicit type', () => {
    const target = makeNode('model.target', 'mart', [{ name: 'amount', type: 'varchar' }]);
    const edges: ColumnLineageEdge[] = [
      { sourceNodeId: sourceNode.id, sourceColumn: 'amount', targetNodeId: target.id, targetColumn: 'amount' },
    ];
    const result = inferColumnTransformation(target, target.columns![0], edges, [sourceNode, target]);
    expect(result).toBe('cast');
  });
});
