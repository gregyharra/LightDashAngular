import {
  AdditionalMetric,
  FieldId,
  MetricAggregation,
} from '../../../core/models/explore.model';

export type CustomMetricDraft = {
  name: string;
  label: string;
  tableName: string;
  aggregation: MetricAggregation;
  dimensionFieldId: FieldId;
};

/** SQL-safe identifier: letter/underscore start, then alphanumeric/underscore. */
export const CUSTOM_METRIC_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function isValidCustomMetricName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && CUSTOM_METRIC_NAME_PATTERN.test(trimmed);
}

export function buildAdditionalMetric(
  draft: CustomMetricDraft,
): AdditionalMetric {
  return {
    name: draft.name.trim(),
    label: draft.label.trim(),
    tableName: draft.tableName,
    expr: {
      type: 'agg',
      op: draft.aggregation,
      arg: {
        type: 'field',
        fieldId: draft.dimensionFieldId,
      },
    },
  };
}
