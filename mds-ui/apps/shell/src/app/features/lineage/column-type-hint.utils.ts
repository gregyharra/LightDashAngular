const NUMERIC_TYPE_RE =
  /\b(int\d*|integer|bigint|smallint|tinyint|float|double|real|decimal|numeric|number|money)\b/i;

export function columnTypeHint(
  type: string | null | undefined,
): '#' | 'Aa' | null {
  const normalized = type?.trim() ?? '';
  if (!normalized) {
    return null;
  }
  return NUMERIC_TYPE_RE.test(normalized) ? '#' : 'Aa';
}
