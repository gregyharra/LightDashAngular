export type LineageNodeType = 'source' | 'staging' | 'mart' | 'seed';

export type LineageViewMode = 'models' | 'columns';

export type LineageGraphMode = 'focus' | 'full';

/** Number of upstream/downstream hops in focus mode, or Infinity for full closure. */
export type LineageHopDepth = number;

export type DbtTreeItemType = 'folder' | 'model' | 'seed' | 'source' | 'sources_file';

export interface DbtTreeNode {
  id: string;
  name: string;
  path: string;
  type: DbtTreeItemType;
  description?: string;
  /** Links to lineage node id when this tree item is selectable */
  lineageNodeId?: string;
  children?: DbtTreeNode[];
}

export interface ProjectDbtTree {
  projectUuid: string;
  projectName: string;
  root: DbtTreeNode[];
}

/** How a column was produced from its upstream inputs (dbt-colibri-style). */
export type ColumnTransformationType =
  | 'source'
  | 'pass-through'
  | 'rename'
  | 'cast'
  | 'derived'
  | 'coalesce'
  | 'aggregate'
  | 'join-key';

export interface LineageColumn {
  name: string;
  type: string;
  description?: string;
  tags?: string[];
  /** Explicit transformation when known; otherwise inferred from column edges. */
  transformationType?: ColumnTransformationType;
  /** Primary upstream column name when renamed or derived from a single source. */
  sourceColumn?: string;
  /** SQL expression hint when the column is computed. */
  expression?: string;
}

export interface ColumnLineageEdge {
  sourceNodeId: string;
  sourceColumn: string;
  targetNodeId: string;
  targetColumn: string;
  transformationType?: ColumnTransformationType;
  expression?: string;
}

export interface LineageNode {
  id: string;
  name: string;
  type: LineageNodeType;
  schema: string;
  database: string;
  catalog: string;
  columnCount: number;
  columns?: LineageColumn[];
  description?: string;
  materialization?: string;
  tags?: string[];
  packageName?: string;
  /** dbt project file path, e.g. models/marts/fct_orders.sql */
  dbtPath?: string;
  /** Uncompiled dbt source SQL (manifest raw_code or project file; may include Jinja). */
  sql?: string;
  /** Compiled warehouse SQL from dbt manifest compiled_code or target/compiled. */
  compiledSql?: string;
}

export interface LineageEdge {
  source: string;
  target: string;
}

export interface DbtProjectSummary {
  name: string;
  version: string;
  profile: string;
  lastCompiledAt: string;
  modelCount: number;
  seedCount: number;
  sourceCount: number;
}

/** Project-level dbt lineage graph returned by GET /projects/:uuid/lineage */
export interface ProjectLineage {
  projectUuid: string;
  projectName: string;
  warehouseType: string;
  dbtProject: DbtProjectSummary;
  nodes: LineageNode[];
  edges: LineageEdge[];
  columnEdges?: ColumnLineageEdge[];
}

export interface LineageNodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SelectedColumnRef {
  nodeId: string;
  columnName: string;
}

export type LineageDetailTab = 'overview' | 'columns' | 'sql' | 'lineage';

export interface ColumnSelectionEvent {
  ref: SelectedColumnRef;
  detailTab?: LineageDetailTab;
}
