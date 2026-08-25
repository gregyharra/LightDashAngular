import {
  ColumnLineageEdge,
  ColumnTransformationType,
  LineageColumn,
  LineageNode,
} from '../../core/models/lineage.model';
import { columnNamesEqual, findColumnByName } from './lineage-column-utils';

export type TransformationChipMode = 'compact' | 'full';

export const TRANSFORMATION_TYPES: ColumnTransformationType[] = [
  'source',
  'pass-through',
  'rename',
  'cast',
  'derived',
  'coalesce',
  'aggregate',
  'join-key',
];

/** Single-letter badges (dbt-colibri uses T/R/P/U for its four types). */
export const TRANSFORMATION_SHORT_LABELS: Record<ColumnTransformationType, string> = {
  source: 'S',
  'pass-through': 'P',
  rename: 'R',
  cast: 'C',
  derived: 'D',
  coalesce: '?',
  aggregate: 'A',
  'join-key': 'J',
};

const TRANSFORMATION_TRANSLATION_KEYS: Record<ColumnTransformationType, string> = {
  source: 'source',
  'pass-through': 'passThrough',
  rename: 'rename',
  cast: 'cast',
  derived: 'derived',
  coalesce: 'coalesce',
  aggregate: 'aggregate',
  'join-key': 'joinKey',
};

export function transformationTranslationKey(
  type: ColumnTransformationType,
): string {
  return TRANSFORMATION_TRANSLATION_KEYS[type];
}

/** CSS custom property names for SVG/HTML chip theming. */
export function transformationCssVar(
  type: ColumnTransformationType,
  part: 'bg' | 'text' | 'border',
): string {
  return `var(--ld-transform-${type}-${part})`;
}

const NUMERIC_TYPE_PATTERN =
  /^(?:bigint|int(?:eger)?|smallint|tinyint|decimal|numeric|float|double|real|number)/i;

function normalizeColumnType(type: string): string {
  const base = type.trim().toLowerCase().split('(')[0];
  if (NUMERIC_TYPE_PATTERN.test(base)) {
    return 'number';
  }
  if (base.includes('bool')) {
    return 'boolean';
  }
  if (base === 'date') {
    return 'date';
  }
  if (base.includes('timestamp') || base.includes('datetime')) {
    return 'timestamp';
  }
  return base || 'string';
}

function inferFromEdge(
  edge: ColumnLineageEdge,
  targetColumn: LineageColumn,
  nodes: LineageNode[],
): ColumnTransformationType {
  if (edge.transformationType) {
    return edge.transformationType;
  }

  const sourceNode = nodes.find((node) => node.id === edge.sourceNodeId);
  const sourceColumn = findColumnByName(sourceNode?.columns, edge.sourceColumn);
  const sameName = columnNamesEqual(edge.sourceColumn, edge.targetColumn);
  const sameType =
    !!sourceColumn &&
    normalizeColumnType(sourceColumn.type) === normalizeColumnType(targetColumn.type);

  if (sameName && sameType) {
    return 'pass-through';
  }
  if (!sameName && sameType) {
    return 'rename';
  }
  if (!sameType) {
    return 'cast';
  }
  return 'pass-through';
}

/** Infer how a column was produced from lineage edges and node metadata. */
export function inferColumnTransformation(
  node: LineageNode,
  column: LineageColumn,
  columnEdges: ColumnLineageEdge[],
  nodes: LineageNode[],
): ColumnTransformationType {
  if (column.transformationType) {
    return column.transformationType;
  }

  const incoming = columnEdges.filter(
    (edge) => edge.targetNodeId === node.id && columnNamesEqual(edge.targetColumn, column.name),
  );

  if (incoming.length === 0) {
    if (node.type === 'source' || node.type === 'seed') {
      return 'source';
    }
    return 'derived';
  }

  if (incoming.length > 1) {
    // Backend classification (aggregate/coalesce/cast/derived/join-key/...) is per
    // target-column expression, so every ref edge for this column carries the same
    // explicit type — trust it instead of re-deriving from the raw edge shape.
    const explicit = incoming.find((edge) => edge.transformationType)?.transformationType;
    return explicit ?? 'derived';
  }

  return inferFromEdge(incoming[0], column, nodes);
}
