const FORBIDDEN = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|EXEC|EXECUTE|TRUNCATE|CREATE|MERGE|BULK)\b/i;

export function validateSql(querySql: string | null): { valid: boolean; reason?: string } {
  if (!querySql || !querySql.trim()) {
    return { valid: false, reason: 'No SQL was generated for this question.' };
  }

  if (FORBIDDEN.test(querySql)) {
    return { valid: false, reason: 'Generated query contains a forbidden keyword. Only SELECT statements are permitted.' };
  }

  // Detect multiple statements: strip string literals, then count semicolons
  const withoutStrings = querySql.replace(/'[^']*'/g, "''");
  const semicolonMatches = withoutStrings.match(/;/g) ?? [];
  const trailingOnly = querySql.trimEnd().endsWith(';') && semicolonMatches.length === 1;

  if (semicolonMatches.length > 1 || (semicolonMatches.length === 1 && !trailingOnly)) {
    return { valid: false, reason: 'Query appears to contain multiple statements.' };
  }

  return { valid: true };
}
