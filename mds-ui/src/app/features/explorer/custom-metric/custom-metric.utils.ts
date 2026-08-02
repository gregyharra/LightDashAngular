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
