export type ModelJoinOrigin = 'dbt' | 'custom';

export type ModelJoinView = {
  uuid?: string;
  sourceModelId: string;
  sourceModelName: string;
  sourceColumn: string;
  targetModelId: string;
  targetModelName: string;
  targetColumn: string;
  joinType: string;
  relationship?: string | null;
  label?: string | null;
  sqlOn: string;
  origin: ModelJoinOrigin;
};

export type ModelJoinCreate = {
  sourceModelId: string;
  sourceColumn: string;
  targetModelId: string;
  targetColumn: string;
  joinType?: string;
  relationship?: string | null;
  label?: string | null;
};

export type ModelJoinUpdate = Partial<ModelJoinCreate>;

export type LinkDialogMode = 'hub' | 'project';

export type ModelLinkOption = {
  id: string;
  name: string;
  columns: { name: string; type: string }[];
};

export type LinkDialogSavePayload = ModelJoinCreate & { uuid?: string };
