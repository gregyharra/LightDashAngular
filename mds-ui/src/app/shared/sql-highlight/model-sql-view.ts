/** Toggle between dbt compiled warehouse SQL and uncompiled source (Jinja). */
export type ModelSqlViewMode = 'compiled' | 'uncompiled';

export function preferredModelSqlViewMode(
  sql: string | null | undefined,
  compiledSql: string | null | undefined,
): ModelSqlViewMode {
  if (compiledSql?.trim()) {
    return 'compiled';
  }
  return 'uncompiled';
}

export function resolveModelSqlDisplay(
  sql: string | null | undefined,
  compiledSql: string | null | undefined,
  mode: ModelSqlViewMode,
): string | null {
  if (mode === 'compiled' && compiledSql?.trim()) {
    return compiledSql;
  }
  if (sql?.trim()) {
    return sql;
  }
  if (compiledSql?.trim()) {
    return compiledSql;
  }
  return null;
}
