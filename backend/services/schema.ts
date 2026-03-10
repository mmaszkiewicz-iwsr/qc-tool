import { getPool } from './database';
import { SchemaTable, SchemaColumn } from '../types';

let cachedSchema: SchemaTable[] = [];
let cachedSchemaString = '';

const SCHEMA_QUERY = `
SELECT
  c.TABLE_SCHEMA,
  c.TABLE_NAME,
  c.COLUMN_NAME,
  c.DATA_TYPE,
  c.IS_NULLABLE,
  c.CHARACTER_MAXIMUM_LENGTH,
  c.NUMERIC_PRECISION,
  c.NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS c
INNER JOIN INFORMATION_SCHEMA.TABLES t
  ON t.TABLE_NAME = c.TABLE_NAME
  AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
  AND t.TABLE_TYPE = 'BASE TABLE'
ORDER BY
  c.TABLE_SCHEMA,
  c.TABLE_NAME,
  c.ORDINAL_POSITION
`;

export async function loadSchema(): Promise<void> {
  const pool = await getPool();
  const result = await pool.request().query(SCHEMA_QUERY);
  const rows = result.recordset as Array<{
    TABLE_SCHEMA: string;
    TABLE_NAME: string;
    COLUMN_NAME: string;
    DATA_TYPE: string;
    IS_NULLABLE: string;
    CHARACTER_MAXIMUM_LENGTH: number | null;
    NUMERIC_PRECISION: number | null;
    NUMERIC_SCALE: number | null;
  }>;

  // Group columns by table
  const tableMap = new Map<string, SchemaTable>();
  for (const row of rows) {
    const key = `${row.TABLE_SCHEMA}.${row.TABLE_NAME}`;
    if (!tableMap.has(key)) {
      tableMap.set(key, {
        schema: row.TABLE_SCHEMA,
        tableName: row.TABLE_NAME,
        columns: [],
      });
    }

    let typeLabel = row.DATA_TYPE;
    if (row.CHARACTER_MAXIMUM_LENGTH) typeLabel += `(${row.CHARACTER_MAXIMUM_LENGTH === -1 ? 'max' : row.CHARACTER_MAXIMUM_LENGTH})`;
    else if (row.NUMERIC_PRECISION != null) typeLabel += `(${row.NUMERIC_PRECISION}${row.NUMERIC_SCALE != null ? `,${row.NUMERIC_SCALE}` : ''})`;

    const column: SchemaColumn = {
      name: row.COLUMN_NAME,
      type: typeLabel,
      nullable: row.IS_NULLABLE === 'YES',
    };
    tableMap.get(key)!.columns.push(column);
  }

  cachedSchema = Array.from(tableMap.values());
  cachedSchemaString = serializeSchema(cachedSchema);

  console.log(`[schema] Loaded ${cachedSchema.length} tables`);
}

function serializeSchema(tables: SchemaTable[]): string {
  return tables
    .map((t) => {
      const cols = t.columns
        .map((c) => `    - ${c.name}: ${c.type}${c.nullable ? ' (nullable)' : ''}`)
        .join('\n');
      return `Table: ${t.schema}.${t.tableName}\n${cols}`;
    })
    .join('\n\n');
}

export function getSchemaContext(): string {
  return cachedSchemaString;
}

export function getCachedSchema(): SchemaTable[] {
  return cachedSchema;
}
