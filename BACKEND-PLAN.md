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

## Status

> Last updated: 2026-03-10

| Step | Module | Status | Notes |
|---|---|---|---|
| 1 | Scaffold / config | ✅ Code complete | `npm install` not yet run — need Node in PATH |
| 2 | `services/database.ts` | ✅ Code complete | Awaiting live connection test |
| 3 | `services/schema.ts` | ⚠️ Partial | Columns loaded; FK relationships not yet added |
| 4 | `services/claude.ts` | ✅ Code complete | `ANTHROPIC_API_KEY` still empty in `.env`; `interpretResults()` added (second call) |
| 5 | `middleware/sqlGuard.ts` | ✅ Code complete | Manual review passed; unit tests not written |
| 6 | `routes/query.ts` | ✅ Code complete | All error codes wired (400/422/500/503/504) |
| 7 | `middleware/rateLimit.ts` | ✅ Code complete | — |
| 8 | `middleware/auth.ts` | ⏳ Deferred | Phase 2 — JWT or Azure AD |
| 9 | `services/audit.ts` | ✅ Code complete | Writes to `logs/audit.log` (NDJSON) |

**Next actions before first live test:**
1. Open a terminal with nvm-windows active → `nvm use lts` → `cd backend && npm install`
2. Add `ANTHROPIC_API_KEY` to `.env`
3. Run `npx ts-node server.ts` and watch startup logs for DB + schema messages
4. Smoke test: `curl -X POST http://localhost:3001/api/query -H "Content-Type: application/json" -d "{\"question\":\"How many rows are in each table?\"}"`

---

## Build Order

Work through these steps in sequence. Each step can be tested independently before moving on.

### Step 1 — Scaffold & config ✅

- [x] `npm init`, add `typescript`, `ts-node`, `nodemon`, `express`, `dotenv`
- [x] `tsconfig.json` targeting ES2020 / Node 18+
- [x] `server.ts` — Express app that reads `.env`, wires middleware and routes, listens on `PORT`
- [ ] **TODO**: run `npm install` (blocked until Node is available in shell)
- [ ] **TODO**: confirm `npx ts-node server.ts` starts without errors

### Step 2 — Database connection (`services/database.ts`) ✅

- [x] Install `mssql` (in package.json)
- [x] Connection pool using `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`
- [x] `DB_SERVER` parsed to split host and port (`host,1433` format)
- [x] Export `connect()`, `getPool()`, `executeQuery(sql): Promise<QueryResult>`
- [x] `QUERY_TIMEOUT_MS` enforced per request; `MAX_ROWS` caps result set
- [ ] **TODO**: confirm live connection to `warehouse.preview.theiwsr.net`

### Step 3 — Schema introspection (`services/schema.ts`) ⚠️

- [x] Query `INFORMATION_SCHEMA.COLUMNS` on startup
- [x] Build `SchemaTable[]` with type labels (length/precision appended)
- [x] Cache in memory; serialize to string for Claude prompts
- [x] Log table count on startup
- [ ] **TODO**: add FK relationships via `INFORMATION_SCHEMA.TABLE_CONSTRAINTS` / `KEY_COLUMN_USAGE`
- [ ] **TODO**: add `GET /api/schema/refresh` endpoint

### Step 4 — Claude integration (`services/claude.ts`) ✅

- [x] `@anthropic-ai/sdk` in package.json
- [x] `buildSystemPrompt(schema)` injects live schema into system prompt
- [x] `generateQuery(question, schema)` calls `messages.create`
- [x] Response parsed as JSON `{ sql, summary, chartHint }`
- [x] Malformed JSON throws structured error; markdown fences stripped defensively
- [x] `chartHint` normalised to known values
- [ ] **TODO**: add `ANTHROPIC_API_KEY` to `.env` and confirm live call

### Step 5 — SQL guard (`middleware/sqlGuard.ts`) ✅

- [x] Rejects null / empty SQL
- [x] Rejects all forbidden DML/DDL keywords (case-insensitive, word-boundary match)
- [x] Rejects multiple statements (semicolons not at trailing position)
- [x] String literals stripped before semicolon count to avoid false positives
- [ ] **TODO**: write unit tests

### Step 6 — Query route (`routes/query.ts`) ✅

Wire steps 2–5 together into the request/response cycle:

```
POST /api/query
  body: { question: string }

1. Validate request body
2. Get cached schema string (503 if not ready)
3. Call claude.ts → { sql, summary, chartHint }
4. Call sqlGuard → reject if invalid
5. Call database.ts → { columns, rows, truncated }
6. Return { summary, sql, columns, rows, truncated, chartHint }
```

Error responses:
- `400` — missing question
- `422` — SQL guard rejected the generated query
- `500` — DB error or Claude API error
- `503` — schema not yet loaded
- `504` — query exceeded timeout

### Step 7 — Rate limiting (`middleware/rateLimit.ts`) ✅

- [x] `express-rate-limit` in package.json
- [x] `RATE_LIMIT_PER_MINUTE` from env (default 20)
- [x] Applied to all `/api/*` routes in `server.ts`

### Step 8 — Auth (`middleware/auth.ts`) ⏳ Phase 2

MVP ships without auth. Add this in Phase 2.

- **Option A — JWT**: verify `Authorization: Bearer <token>` using `jsonwebtoken` + `JWT_SECRET`
- **Option B — Azure AD**: validate tokens using `@azure/msal-node` + `AZURE_CLIENT_ID` / `AZURE_TENANT_ID`

Decide based on whether the app is deployed inside Azure AD tenant or standalone.

### Step 9 — Audit logging (`services/audit.ts`) ✅

- [x] `writeAuditLog()` called after every successful query execution
- [x] Writes newline-delimited JSON to `logs/audit.log`
- [x] Logs: `timestamp`, `question`, `sql`, `rowCount`, `truncated`, `durationMs`
- [x] Never logs DB credentials or row data
- [x] `logs/.gitkeep` committed; `*.log` excluded via `.gitignore`

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
