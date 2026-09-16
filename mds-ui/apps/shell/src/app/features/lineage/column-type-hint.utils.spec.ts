import { columnTypeHint } from './column-type-hint.utils';

describe('columnTypeHint', () => {
  it('returns null when type is missing or blank', () => {
    expect(columnTypeHint(undefined)).toBeNull();
    expect(columnTypeHint(null)).toBeNull();
    expect(columnTypeHint('')).toBeNull();
    expect(columnTypeHint('   ')).toBeNull();
  });

  it('returns # for numeric-ish types', () => {
    expect(columnTypeHint('integer')).toBe('#');
    expect(columnTypeHint('INT64')).toBe('#');
    expect(columnTypeHint('numeric(18,2)')).toBe('#');
    expect(columnTypeHint('double precision')).toBe('#');
    expect(columnTypeHint('float')).toBe('#');
    expect(columnTypeHint('decimal')).toBe('#');
    expect(columnTypeHint('bigint')).toBe('#');
  });

  it('returns Aa for other non-empty types', () => {
    expect(columnTypeHint('varchar')).toBe('Aa');
    expect(columnTypeHint('text')).toBe('Aa');
    expect(columnTypeHint('boolean')).toBe('Aa');
    expect(columnTypeHint('timestamp')).toBe('Aa');
    expect(columnTypeHint('date')).toBe('Aa');
  });
});
