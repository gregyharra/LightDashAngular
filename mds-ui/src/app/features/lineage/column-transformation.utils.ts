import {
  ColumnLineageEdge,
  ColumnTransformationType,
  LineageColumn,
  LineageNode,
} from '../../core/models/lineage.model';

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

export const TRANSFORMATION_LABELS: Record<ColumnTransformationType, string> = {
  source: 'source',
  'pass-through': 'pass-through',
  rename: 'rename',
  cast: 'cast',
  derived: 'derived',
  coalesce: 'coalesce',
  aggregate: 'aggregate',
  'join-key': 'join-key',
};

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

export const TRANSFORMATION_DESCRIPTIONS: Record<ColumnTransformationType, string> = {
  source: 'Original column from a source or seed table',
  'pass-through': 'Unchanged from the upstream column',
  rename: 'Renamed from an upstream column with the same value',
  cast: 'Type cast or conversion from upstream',
  derived: 'Computed from one or more upstream columns',
  coalesce: 'First non-null value from multiple upstream columns',
  aggregate: 'Aggregated across rows (sum, count, etc.)',
  'join-key': 'Brought in via a join from another model',
};

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
  const sourceColumn = sourceNode?.columns?.find((col) => col.name === edge.sourceColumn);
  const sameName = edge.sourceColumn === edge.targetColumn;
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
    (edge) => edge.targetNodeId === node.id && edge.targetColumn === column.name,
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

export function transformationLabel(type: ColumnTransformationType): string {
  return TRANSFORMATION_LABELS[type];
}

export function transformationDescription(type: ColumnTransformationType): string {
  return TRANSFORMATION_DESCRIPTIONS[type];
}

export function transformationChipLabel(
  type: ColumnTransformationType,
  mode: TransformationChipMode,
): string {
  return mode === 'compact' ? TRANSFORMATION_SHORT_LABELS[type] : TRANSFORMATION_LABELS[type];
}

/** Approximate pixel width for SVG chip layout. */
export function transformationChipWidth(
  type: ColumnTransformationType,
  mode: TransformationChipMode = 'full',
): number {
  if (mode === 'compact') {
    return 18;
  }
  return transformationLabel(type).length * 5.5 + 12;
}

/** @deprecated Use transformationChipWidth */
export function transformationBadgeWidth(type: ColumnTransformationType): number {
  return transformationChipWidth(type, 'full');
}
