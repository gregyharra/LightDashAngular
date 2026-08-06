import { GaugeChartConfigBody } from '../../../core/models/chart.model';
import { QueryResults } from '../../../core/models/explore.model';
import { buildGaugeOption } from './build-gauge-option';

const results: QueryResults = {
  queryUuid: 'query-1',
  metricQuery: {
    exploreName: 'orders',
    dimensions: [],
    metrics: ['orders_total'],
    filters: {},
    sorts: [],
    limit: 500,
    tableCalculations: [],
    additionalMetrics: [],
  },
  rows: [
    {
      orders_total: { value: { raw: 42, formatted: '42' } },
    },
  ],
  fields: {
    orders_total: {
      fieldId: 'orders_total',
      fieldType: 'metric',
      type: 'sum',
      name: 'total',
      label: 'Total',
      table: 'orders',
      tableLabel: 'Orders',
      sql: 'SUM(${TABLE}.total)',
      hidden: false,
    },
  },
  cacheMetadata: { cacheHit: false },
};

const config: GaugeChartConfigBody = {
  selectedField: 'orders_total',
  min: 0,
  max: 100,
  showLabel: true,
  rowLimit: 500,
  margins: { top: 8, right: 8, bottom: 8, left: 8 },
};

describe('buildGaugeOption', () => {
  it('builds gauge series with detail value from first row', () => {
    const option = buildGaugeOption({ results, config });
    const series = option?.series as Array<{
      type?: string;
      data?: { value: number }[];
      detail?: { show?: boolean };
    }>;
    expect(series?.[0].type).toBe('gauge');
    expect(series?.[0].data?.[0].value).toBe(42);
    expect(series?.[0].detail?.show).toBe(true);
  });

  it('defaults min to 0 and max from value when unset', () => {
    const option = buildGaugeOption({
      results,
      config: { ...config, min: undefined, max: undefined },
    });
    const series = option?.series as Array<{ min?: number; max?: number }>;
    expect(series?.[0].min).toBe(0);
    expect(series?.[0].max).toBe(Math.max(42 * 1.25, 42, 1));
  });

  it('uses configured min and max when set', () => {
    const option = buildGaugeOption({
      results,
      config: { ...config, min: 10, max: 200 },
    });
    const series = option?.series as Array<{ min?: number; max?: number }>;
    expect(series?.[0].min).toBe(10);
    expect(series?.[0].max).toBe(200);
  });

  it('hides detail when showLabel is false', () => {
    const option = buildGaugeOption({
      results,
      config: { ...config, showLabel: false },
    });
    const series = option?.series as Array<{ detail?: { show?: boolean } }>;
    expect(series?.[0].detail?.show).toBe(false);
  });

  it('returns null without selectedField, rows, or missing field in results', () => {
    expect(
      buildGaugeOption({ results: { ...results, rows: [] }, config }),
    ).toBeNull();
    expect(
      buildGaugeOption({
        results,
        config: { ...config, selectedField: undefined },
      }),
    ).toBeNull();
    expect(
      buildGaugeOption({
        results,
        config: { ...config, selectedField: 'missing_metric' },
      }),
    ).toBeNull();
  });
});
