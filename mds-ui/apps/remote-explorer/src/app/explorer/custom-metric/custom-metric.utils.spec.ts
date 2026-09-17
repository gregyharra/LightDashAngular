import {
  buildAdditionalMetric,
  isValidCustomMetricName,
} from './custom-metric.utils';

describe('buildAdditionalMetric', () => {
  it('builds an aggregation AST and table-prefixed field ID', () => {
    expect(
      buildAdditionalMetric({
        name: 'total_amount',
        label: 'Total amount',
        tableName: 'orders',
        aggregation: 'sum',
        dimensionFieldId: 'orders_amount',
      }),
    ).toEqual({
      name: 'total_amount',
      label: 'Total amount',
      tableName: 'orders',
      expr: {
        type: 'agg',
        op: 'sum',
        arg: { type: 'field', fieldId: 'orders_amount' },
      },
    });
  });

  it('trims dialog values before constructing the metric', () => {
    expect(
      buildAdditionalMetric({
        name: ' unique_customers ',
        label: ' Unique customers ',
        tableName: 'customers',
        aggregation: 'count_distinct',
        dimensionFieldId: 'customers_id',
      }),
    ).toEqual({
      name: 'unique_customers',
      label: 'Unique customers',
      tableName: 'customers',
      expr: {
        type: 'agg',
        op: 'count_distinct',
        arg: { type: 'field', fieldId: 'customers_id' },
      },
    });
  });
});

describe('isValidCustomMetricName', () => {
  it('accepts valid identifiers', () => {
    expect(isValidCustomMetricName('total_amount')).toBe(true);
    expect(isValidCustomMetricName('_private')).toBe(true);
    expect(isValidCustomMetricName('Metric2')).toBe(true);
  });

  it('rejects empty or whitespace-only names', () => {
    expect(isValidCustomMetricName('')).toBe(false);
    expect(isValidCustomMetricName('   ')).toBe(false);
  });

  it('rejects names starting with a digit', () => {
    expect(isValidCustomMetricName('2total')).toBe(false);
  });

  it('rejects names with spaces or special characters', () => {
    expect(isValidCustomMetricName('total amount')).toBe(false);
    expect(isValidCustomMetricName('total-amount')).toBe(false);
    expect(isValidCustomMetricName('total.amount')).toBe(false);
  });

  it('validates trimmed names', () => {
    expect(isValidCustomMetricName(' total_amount ')).toBe(true);
    expect(isValidCustomMetricName(' 2bad ')).toBe(false);
  });
});
