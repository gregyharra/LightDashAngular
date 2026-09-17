import { tokenizeSql } from './sql-tokenizer';

describe('tokenizeSql', () => {
  it('returns empty for empty input', () => {
    expect(tokenizeSql('')).toEqual([]);
  });

  it('highlights keywords case-insensitively', () => {
    const tokens = tokenizeSql('SELECT id From orders WHERE 1');
    expect(tokens.map((t) => [t.type, t.text])).toEqual([
      ['keyword', 'SELECT'],
      ['plain', ' id '],
      ['keyword', 'From'],
      ['plain', ' orders '],
      ['keyword', 'WHERE'],
      ['plain', ' '],
      ['number', '1'],
    ]);
  });

  it('highlights line and block comments', () => {
    const tokens = tokenizeSql('-- ahead\nselect /* mid */ 1');
    expect(tokens[0]).toEqual({ type: 'comment', text: '-- ahead' });
    expect(tokens.some((t) => t.type === 'comment' && t.text === '/* mid */')).toBeTrue();
  });

  it('highlights strings with escaped quotes', () => {
    const tokens = tokenizeSql("select 'it''s' as x");
    expect(tokens.some((t) => t.type === 'string' && t.text === "'it''s'")).toBeTrue();
  });

  it('highlights jinja ref/source and control blocks', () => {
    const sql = `from {{ ref('stg_orders') }} {% if true %} {{ source('raw', 't') }} {% endif %}`;
    const tokens = tokenizeSql(sql);
    const jinja = tokens.filter((t) => t.type === 'jinja').map((t) => t.text);
    expect(jinja).toEqual([
      "{{ ref('stg_orders') }}",
      '{% if true %}',
      "{{ source('raw', 't') }}",
      '{% endif %}',
    ]);
  });

  it('treats jinja comments as jinja tokens', () => {
    const tokens = tokenizeSql('{# note #}\nselect 1');
    expect(tokens[0]).toEqual({ type: 'jinja', text: '{# note #}' });
  });
});
