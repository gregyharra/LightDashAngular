export type DictionaryQuality = {
  projectUuid: string;
  score: number;
  models: { total: number; described: number; coverage: number };
  columns: { total: number; described: number; coverage: number };
  tags: { modelsWithTags: number; coverage: number };
};

export type DictionaryListNode = {
  id: string;
  name: string;
  type: string;
  description?: string | null;
  dbtDescription?: string | null;
  descriptionOverride?: string | null;
  tags: string[];
  custom: Record<string, unknown>;
  columnCount: number;
  hasOverlay: boolean;
};

export type DictionaryListResponse = {
  projectUuid: string;
  projectName: string;
  nodes: DictionaryListNode[];
};

export type DictionaryColumn = {
  name: string;
  type: string;
  description?: string | null;
  dbtDescription?: string | null;
  descriptionOverride?: string | null;
  tags: string[];
  custom: Record<string, unknown>;
  hasOverlay: boolean;
};

export type DictionaryEntry = {
  id: string;
  name: string;
  type: string;
  schema?: string;
  database?: string;
  catalog?: string;
  materialization?: string;
  packageName?: string;
  dbtPath?: string;
  /** Uncompiled dbt source SQL (may include Jinja). */
  sql?: string;
  /** Compiled warehouse SQL from dbt artifacts when available. */
  compiledSql?: string;
  description?: string | null;
  dbtDescription?: string | null;
  descriptionOverride?: string | null;
  tags: string[];
  custom: Record<string, unknown>;
  columns: DictionaryColumn[];
  hasOverlay: boolean;
};

export type DictionaryModelUpdate = {
  descriptionOverride?: string | null;
  tags?: string[];
  custom?: Record<string, unknown>;
};

export type DictionaryColumnUpdate = {
  descriptionOverride?: string | null;
  tags?: string[];
  custom?: Record<string, unknown>;
};

/**
 * User-defined attribute types supported on the table-hub Columns tab.
 * Definitions are persisted on the model overlay's `custom` JSON under the
 * reserved `CUSTOM_ATTRIBUTE_DEFS_KEY`; per-column values live in each
 * column's own `custom[attrId]`.
 */
export type CustomAttributeType = 'text' | 'number' | 'enum' | 'boolean';

export type CustomAttributeDef = {
  id: string;
  name: string;
  type: CustomAttributeType;
  options?: string[];
};

export const CUSTOM_ATTRIBUTE_DEFS_KEY = '_attributeDefs';
