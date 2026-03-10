import sql from 'mssql';
import { QueryResult } from '../types';

const requiredEnv = ['DB_SERVER', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'] as const;
for (const key of requiredEnv) {
  if (!process.env[key]) throw new Error(`Missing required environment variable: ${key}`);
}

// DB_SERVER may include port as "host,port" — split it out for mssql config
const [dbServer, dbPortStr] = process.env.DB_SERVER!.split(',');
const dbPort = dbPortStr ? parseInt(dbPortStr, 10) : 1433;

const poolConfig: sql.config = {
  server: dbServer,
  port: dbPort,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT !== 'false',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    requestTimeout: parseInt(process.env.QUERY_TIMEOUT_MS ?? '30000', 10),
    connectTimeout: 15000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function connect(): Promise<void> {
  pool = await new sql.ConnectionPool(poolConfig).connect();
  console.log(`[db] Connected to ${dbServer}/${process.env.DB_NAME}`);
}

export async function getPool(): Promise<sql.ConnectionPool> {
  if (!pool) throw new Error('Database pool not initialised — call connect() first.');
  return pool;
}

export async function executeQuery(querySql: string): Promise<QueryResult> {
  const maxRows = parseInt(process.env.MAX_ROWS ?? '1000', 10);
  const db = await getPool();

  const request = new sql.Request(db);
  const result = await request.query(querySql);
  const allRows = result.recordset as Record<string, unknown>[];

  const truncated = allRows.length > maxRows;
  const rows = truncated ? allRows.slice(0, maxRows) : allRows;
  const columns = result.recordset.columns
    ? Object.keys(result.recordset.columns)
    : rows.length > 0 ? Object.keys(rows[0]) : [];

  return { columns, rows, truncated };
}
