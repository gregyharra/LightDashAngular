import {
  DEFAULT_QUERY_LIMIT,
  FALLBACK_MAX_QUERY_LIMIT,
  clampQueryLimit,
  resolveCsvMaxLimit,
  resolveMaxQueryLimit,
} from './query-limit.utils';

describe('query-limit.utils', () => {
  it('resolves maxLimit from health or falls back', () => {
    expect(resolveMaxQueryLimit(1_000_000)).toBe(1_000_000);
    expect(resolveMaxQueryLimit(undefined)).toBe(FALLBACK_MAX_QUERY_LIMIT);
    expect(resolveMaxQueryLimit(0)).toBe(FALLBACK_MAX_QUERY_LIMIT);
  });

  it('resolves csvMaxLimit from health or 5 million', () => {
    expect(resolveCsvMaxLimit(5_000_000)).toBe(5_000_000);
    expect(resolveCsvMaxLimit(undefined)).toBe(5_000_000);
    expect(resolveCsvMaxLimit(0)).toBe(5_000_000);
  });

  it('clamps row limits to [1, max]', () => {
    expect(clampQueryLimit(500, 1000)).toBe(500);
    expect(clampQueryLimit(0, 1000)).toBe(1);
    expect(clampQueryLimit(9999, 1000)).toBe(1000);
    expect(clampQueryLimit(250.9, 1000)).toBe(250);
    expect(clampQueryLimit('400', 1000)).toBe(400);
    expect(clampQueryLimit('', 1000)).toBe(DEFAULT_QUERY_LIMIT);
    expect(clampQueryLimit(null)).toBe(DEFAULT_QUERY_LIMIT);
  });
});
