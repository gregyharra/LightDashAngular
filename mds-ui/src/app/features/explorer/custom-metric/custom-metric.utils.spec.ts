import { buildAdditionalMetric } from './custom-metric.utils';

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
