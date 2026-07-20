import {
  getDateAnchor,
  mergeTimeTravelIntoMetricQuery,
  resolveSqlTableWithTimeTravel,
} from './time-travel.utils';
import { MetricQuery } from '../../core/models/explore.model';

const baseQuery: MetricQuery = {
  exploreName: 'orders',
  dimensions: [],
  metrics: [],
  filters: {},
  sorts: [],
  limit: 500,
  tableCalculations: [],
  additionalMetrics: [],
};

describe('time-travel.utils', () => {
  it('wraps iceberg tables with Trino time travel syntax', () => {
    const result = resolveSqlTableWithTimeTravel(
      'marts.fct_orders',
      { asOfTimestamp: '2024-01-15T12:00:00.000Z' },
      'iceberg',
    );

    expect(result.sqlRef).toBe(
      "marts.fct_orders FOR TIMESTAMP AS OF TIMESTAMP '2024-01-15 12:00:00'",
    );
    expect(result.warning).toBeUndefined();
  });

  it('warns when table does not support time travel', () => {
    const result = resolveSqlTableWithTimeTravel(
      'raw.events',
      { asOfTimestamp: '2024-01-15T12:00:00.000Z' },
      'none',
    );

    expect(result.sqlRef).toBe('raw.events');
    expect(result.warning?.code).toBe('TIME_TRAVEL_UNSUPPORTED');
  });

  it('uses as-of date as anchor for relative filters', () => {
    expect(
      getDateAnchor({ asOfTimestamp: '2024-02-10T08:30:00.000Z' }),
    ).toBe("DATE '2024-02-10'");
    expect(getDateAnchor(undefined)).toBe('CURRENT_DATE');
  });

  it('merges time travel into metric queries', () => {
    const merged = mergeTimeTravelIntoMetricQuery(baseQuery, {
      asOfTimestamp: '2024-01-01T00:00:00.000Z',
    });

    expect(merged.timeTravel?.asOfTimestamp).toBe('2024-01-01T00:00:00.000Z');
  });
});
