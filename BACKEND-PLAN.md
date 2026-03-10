# Backend Build Plan — QC Tool

Reference: [CLAUDE-MASTER.md](CLAUDE-MASTER.md)

---

## Overview

The backend is a Node.js + Express server written in TypeScript. It is the only process that touches the database and the Anthropic API. The frontend never holds credentials.

Single responsibility per module:

| File | Does one thing |
|---|---|
| `server.ts` | Starts Express, wires middleware and routes |
| `routes/query.ts` | Handles `POST /api/query` end-to-end |
| `services/database.ts` | Owns the mssql connection pool |
| `services/schema.ts` | Introspects and caches DB schema |
| `services/claude.ts` | Builds prompts, calls Anthropic SDK, parses response |
| `middleware/sqlGuard.ts` | Validates SQL is SELECT-only before execution |
| `middleware/rateLimit.ts` | Per-user rate limiting |
| `middleware/auth.ts` | JWT or Azure AD token validation |
| `types.ts` | Shared TypeScript interfaces |

---

## Build Order

Work through these steps in sequence. Each step can be tested independently before moving on.

### Step 1 — Scaffold & config

- [ ] `npm init`, add `typescript`, `ts-node`, `nodemon`, `express`, `dotenv`
- [ ] `tsconfig.json` targeting Node 18+
- [ ] `server.ts` — bare Express app that reads `.env` and listens on a port
- [ ] Confirm: `npx ts-node backend/server.ts` starts without errors

### Step 2 — Database connection (`services/database.ts`)

- [ ] Install `mssql`
- [ ] Create a connection pool using env vars (`DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`)
- [ ] Export `connect()` and `executeQuery(sql: string): Promise<QueryResult>`
- [ ] Enforce `DB_TIMEOUT_MS` per query and `MAX_ROWS` row cap
- [ ] Confirm: call `connect()` at startup and log success/failure

### Step 3 — Schema introspection (`services/schema.ts`)

- [ ] On startup, query `INFORMATION_SCHEMA.COLUMNS` and `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` / `KEY_COLUMN_USAGE` for FK relationships
- [ ] Build a `SchemaTable[]` structure: `{ tableName, columns: [{ name, type, nullable }], foreignKeys: [...] }`
- [ ] Cache the result in memory (refresh on demand via a `GET /api/schema/refresh` endpoint later)
- [ ] Serialize schema to a concise string for injection into Claude prompts
- [ ] Confirm: log the serialized schema on startup

### Step 4 — Claude integration (`services/claude.ts`)

- [ ] Install `@anthropic-ai/sdk`
- [ ] Build `buildSystemPrompt(schema: string): string` — injects schema into the system prompt template
- [ ] Call `anthropic.messages.create(...)` with the system prompt + user question
- [ ] Parse the response as JSON: `{ sql, summary, chartHint }`
- [ ] Handle parse errors: if Claude returns malformed JSON, return a structured error, do not throw
- [ ] Confirm: call with a test question and log the parsed response

### Step 5 — SQL guard (`middleware/sqlGuard.ts`)

- [ ] Accept a SQL string, return `{ valid: boolean, reason?: string }`
- [ ] Reject if any of these appear (case-insensitive): `INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`, `EXEC`, `EXECUTE`, `TRUNCATE`, `CREATE`, `MERGE`, `BULK`
- [ ] Reject if more than one statement is detected (semicolon not at the very end)
- [ ] Reject if `sql` is `null` or empty
- [ ] Confirm: unit-test with known good and bad SQL strings

### Step 6 — Query route (`routes/query.ts`)

Wire steps 2–5 together into the request/response cycle:

```
POST /api/query
  body: { question: string }

1. Validate request body
2. Get cached schema string
3. Call claude.ts → { sql, summary, chartHint }
4. Call sqlGuard → reject if invalid
5. Call database.ts → { columns, rows, truncated }
6. Return { summary, sql, columns, rows, truncated, chartHint }
```

Error responses:
- `400` — missing question, or Claude returned null SQL
- `422` — SQL guard rejected the generated query
- `500` — DB error or Claude API error
- `504` — query exceeded timeout

### Step 7 — Rate limiting (`middleware/rateLimit.ts`)

- [ ] Install `express-rate-limit`
- [ ] 20 requests per user per minute (keyed on IP for MVP; keyed on user ID once auth is added)
- [ ] Apply to all `/api/*` routes

### Step 8 — Auth (`middleware/auth.ts`)

MVP ships without auth. Add this in Phase 2.

- **Option A — JWT**: verify `Authorization: Bearer <token>` using `jsonwebtoken` + `JWT_SECRET`
- **Option B — Azure AD**: validate tokens using `@azure/msal-node` + `AZURE_CLIENT_ID` / `AZURE_TENANT_ID`

Decide based on whether the app is deployed inside Azure AD tenant or standalone.

### Step 9 — Audit logging

- [ ] On every successful query execution, append a structured log entry:
  ```json
  {
    "timestamp": "2025-01-01T00:00:00Z",
    "question": "...",
    "sql": "...",
    "rowCount": 42,
    "truncated": false,
    "durationMs": 310
  }
  ```
- [ ] Write to `logs/audit.log` (newline-delimited JSON)
- [ ] Never log DB credentials or full result rows

---

## Directory Structure

```
/backend
  server.ts
  types.ts
  /routes
    query.ts
  /services
    database.ts
    schema.ts
    claude.ts
  /middleware
    sqlGuard.ts
    rateLimit.ts
    auth.ts
  /logs
    .gitkeep          ← keep folder in git, ignore *.log files
  package.json
  tsconfig.json
```

---

## Key Interfaces (`types.ts`)

```typescript
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
}

export interface SchemaColumn {
  name: string;
  type: string;
  nullable: boolean;
}

export interface SchemaTable {
  tableName: string;
  schema: string;
  columns: SchemaColumn[];
}
```

---

## npm Packages

```bash
# Runtime
npm install express dotenv mssql @anthropic-ai/sdk express-rate-limit

# Auth (add in Phase 2 — pick one)
npm install jsonwebtoken
npm install @azure/msal-node

# Dev
npm install -D typescript ts-node nodemon @types/express @types/node @types/mssql
```

---

## Testing the Backend in Isolation

Before connecting the frontend, test each layer with curl or Postman:

```bash
# Start backend
npx ts-node backend/server.ts

# Test the query endpoint
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How many rows are in each table?"}'
```

Expected response shape:
```json
{
  "summary": "There are 3 tables. The largest is ...",
  "sql": "SELECT TABLE_NAME, ...",
  "columns": ["TABLE_NAME", "ROW_COUNT"],
  "rows": [...],
  "truncated": false,
  "chartHint": "bar"
}
```

---

## Pre-Requisites Before Writing Code

| Item | Source | Env var |
|---|---|---|
| Anthropic API key | console.anthropic.com | `ANTHROPIC_API_KEY` |
| SQL Server hostname | DBA / Azure portal | `DB_SERVER` |
| Database name | DBA | `DB_NAME` |
| Read-only SQL login | DBA (run script below) | `DB_USER` / `DB_PASSWORD` |
| TLS requirement | DBA — yes for Azure SQL, ask for on-prem | `DB_ENCRYPT` |

### Read-only SQL Server login (DBA script)

```sql
-- Run as sysadmin on the SQL Server instance
CREATE LOGIN qc_readonly WITH PASSWORD = 'ReplaceWithStrongPassword!';

-- Run in the target database
USE your_database_name;
CREATE USER qc_readonly FOR LOGIN qc_readonly;

-- Read access on all tables in dbo schema
GRANT SELECT ON SCHEMA::dbo TO qc_readonly;

-- Needed so the backend can read INFORMATION_SCHEMA
GRANT VIEW DEFINITION TO qc_readonly;
```
