export interface QueryRequest {
  question: string;
}

export interface ClaudeResponse {
  sql: string | null;
  summary: string;
  chartHint: 'bar' | 'line' | 'scatter' | 'histogram' | 'none';
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  truncated: boolean;
}

export interface QueryResponse extends QueryResult {
  summary: string;
  sql: string;
  chartHint: ClaudeResponse['chartHint'];
  interpretation: string;
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaTable {
  schema: string;
  tableName: string;
  columns: SchemaColumn[];
}

export interface AuditEntry {
  timestamp: string;
  question: string;
  sql: string;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
}
