export type AiChatMode = 'ask' | 'edit';

export type AiChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type AiProposedChart = {
  name: string;
  tableName: string;
  chartKind: string;
  metricQuery: Record<string, unknown>;
  chartConfig: Record<string, unknown>;
  sql?: string | null;
};

export type AiChatResponse = {
  reply: string;
  mode: AiChatMode;
  proposedChart?: AiProposedChart | null;
  toolsUsed: string[];
};

export type AiChatRequest = {
  messages: AiChatMessage[];
  mode: AiChatMode;
  pageContext?: string;
};
