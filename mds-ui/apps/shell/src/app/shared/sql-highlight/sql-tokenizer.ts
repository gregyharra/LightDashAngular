export type SqlTokenType =
  | 'keyword'
  | 'string'
  | 'comment'
  | 'jinja'
  | 'number'
  | 'plain';

export interface SqlToken {
  type: SqlTokenType;
  text: string;
}

/** Common SQL + warehouse keywords (case-insensitive match). */
const KEYWORDS = new Set(
  [
    'select',
    'from',
    'where',
    'as',
    'and',
    'or',
    'not',
    'in',
    'is',
    'null',
    'true',
    'false',
    'case',
    'when',
    'then',
    'else',
    'end',
    'join',
    'left',
    'right',
    'inner',
    'outer',
    'full',
    'cross',
    'on',
    'using',
    'lateral',
    'natural',
    'group',
    'by',
    'order',
    'having',
    'limit',
    'offset',
    'with',
    'recursive',
    'union',
    'all',
    'distinct',
    'except',
    'intersect',
    'insert',
    'into',
    'values',
    'update',
    'set',
    'delete',
    'create',
    'replace',
    'table',
    'view',
    'drop',
    'alter',
    'add',
    'column',
    'cast',
    'coalesce',
    'nullif',
    'count',
    'sum',
    'avg',
    'min',
    'max',
    'between',
    'like',
    'ilike',
    'exists',
    'over',
    'partition',
    'rows',
    'range',
    'unbounded',
    'preceding',
    'following',
    'current',
    'row',
    'window',
    'qualify',
    'filter',
    'array',
    'struct',
    'unnest',
    'asc',
    'desc',
    'nulls',
    'first',
    'last',
    'interval',
    'date',
    'timestamp',
    'boolean',
    'integer',
    'int',
    'bigint',
    'varchar',
    'string',
    'float',
    'double',
    'decimal',
    'numeric',
    'primary',
    'key',
    'foreign',
    'references',
    'unique',
    'constraint',
    'index',
    'schema',
    'database',
    'catalog',
    'if',
    'elsif',
    'endif',
    'for',
    'materialized',
    'incremental',
    'ephemeral',
  ].map((k) => k.toLowerCase()),
);

function pushPlain(tokens: SqlToken[], text: string): void {
  if (!text) {
    return;
  }
  const last = tokens[tokens.length - 1];
  if (last?.type === 'plain') {
    last.text += text;
    return;
  }
  tokens.push({ type: 'plain', text });
}

function readUntil(
  source: string,
  start: number,
  endMarker: string,
): { end: number; text: string } {
  const idx = source.indexOf(endMarker, start);
  if (idx === -1) {
    return { end: source.length, text: source.slice(start) };
  }
  return { end: idx + endMarker.length, text: source.slice(start, idx + endMarker.length) };
}

/**
 * Lightweight SQL + dbt/Jinja tokenizer for read-only highlighting.
 * Not a full parser — prioritizes readable coloring of keywords, comments,
 * strings, numbers, and `{{ }}` / `{% %}` / `{# #}` blocks.
 */
export function tokenizeSql(sql: string): SqlToken[] {
  if (!sql) {
    return [];
  }

  const tokens: SqlToken[] = [];
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = i + 1 < n ? sql[i + 1] : '';

    // Jinja / dbt templates
    if (ch === '{') {
      if (next === '{') {
        const { end, text } = readUntil(sql, i, '}}');
        tokens.push({ type: 'jinja', text });
        i = end;
        continue;
      }
      if (next === '%') {
        const { end, text } = readUntil(sql, i, '%}');
        tokens.push({ type: 'jinja', text });
        i = end;
        continue;
      }
      if (next === '#') {
        const { end, text } = readUntil(sql, i, '#}');
        tokens.push({ type: 'jinja', text });
        i = end;
        continue;
      }
    }

    // Line comment
    if (ch === '-' && next === '-') {
      let end = i + 2;
      while (end < n && sql[end] !== '\n') {
        end += 1;
      }
      tokens.push({ type: 'comment', text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      const { end, text } = readUntil(sql, i, '*/');
      tokens.push({ type: 'comment', text });
      i = end;
      continue;
    }

    // Single-quoted string ('' escape)
    if (ch === "'") {
      let end = i + 1;
      while (end < n) {
        if (sql[end] === "'" && sql[end + 1] === "'") {
          end += 2;
          continue;
        }
        if (sql[end] === "'") {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ type: 'string', text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // Double-quoted identifier / string
    if (ch === '"') {
      let end = i + 1;
      while (end < n) {
        if (sql[end] === '"' && sql[end + 1] === '"') {
          end += 2;
          continue;
        }
        if (sql[end] === '"') {
          end += 1;
          break;
        }
        end += 1;
      }
      tokens.push({ type: 'string', text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // Number (incl. decimals)
    if (
      (ch >= '0' && ch <= '9') ||
      (ch === '.' && next >= '0' && next <= '9')
    ) {
      let end = i + 1;
      while (end < n && ((sql[end] >= '0' && sql[end] <= '9') || sql[end] === '.')) {
        end += 1;
      }
      tokens.push({ type: 'number', text: sql.slice(i, end) });
      i = end;
      continue;
    }

    // Identifier / keyword
    if (
      (ch >= 'A' && ch <= 'Z') ||
      (ch >= 'a' && ch <= 'z') ||
      ch === '_'
    ) {
      let end = i + 1;
      while (
        end < n &&
        ((sql[end] >= 'A' && sql[end] <= 'Z') ||
          (sql[end] >= 'a' && sql[end] <= 'z') ||
          (sql[end] >= '0' && sql[end] <= '9') ||
          sql[end] === '_')
      ) {
        end += 1;
      }
      const text = sql.slice(i, end);
      const type: SqlTokenType = KEYWORDS.has(text.toLowerCase())
        ? 'keyword'
        : 'plain';
      if (type === 'keyword') {
        tokens.push({ type, text });
      } else {
        pushPlain(tokens, text);
      }
      i = end;
      continue;
    }

    // Everything else (whitespace, punctuation)
    pushPlain(tokens, ch);
    i += 1;
  }

  return tokens;
}
