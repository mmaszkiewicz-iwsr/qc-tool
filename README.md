# QC Tool

AI-powered natural language query tool for QC databases. Ask plain-English questions; Claude writes the SQL, runs it, and explains the results — with charts and tables included.

---

## Prerequisites

- Node.js 20+
- npm 10+
- Access to a SQL Server instance (read-only credentials)
- An Anthropic API key

---

## Setup

### 1. Environment variables

Copy the example and fill in your values:

```bash
cp .env.example .env
```

```env
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6

DB_SERVER=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_ENCRYPT=true

MAX_ROWS=1000
QUERY_TIMEOUT_MS=30000

# Auth — choose one:
JWT_SECRET=
# AZURE_CLIENT_ID=
# AZURE_TENANT_ID=
```

> **Never commit `.env` to source control.**

---

## Running locally

### Backend

```bash
cd backend
npm install
npm run dev          # nodemon watch mode
# or
npx ts-node server.ts
```

The backend starts on **http://localhost:3001** by default.

Test it independently with Postman or curl before wiring up the frontend:

```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "How many records are in the main table?"}'
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on **http://localhost:5173**. The Vite dev server proxies `/api/*` → `http://localhost:3001`, so both services must be running.

---

## Project structure

```
/qc-tool
  /frontend
  /backend
  .env
  CLAUDE-MASTER.md
  README.md
```

---

## Building for production

```bash
# Frontend — outputs to frontend/dist
cd frontend && npm run build

# Backend — compile TypeScript
cd backend && npm run build
```

Deploy `frontend/dist` to Azure Static Web Apps and the compiled backend to Azure App Service. Set all environment variables in the App Service configuration panel (not in source control).

---

## Security notes

- The SQL Server connection uses a **read-only login** — no write permissions at the database level.
- All Claude-generated SQL is validated before execution: any statement containing `INSERT`, `UPDATE`, `DELETE`, `DROP`, `EXEC`, `ALTER`, or multiple statements is rejected.
- Query execution is hard-capped at **30 seconds** and **1,000 rows**.
- All API routes are protected by authentication middleware (JWT or Azure AD).
- Rate limiting is applied per authenticated user per minute.

---

## Development priorities

| Phase | Scope |
|---|---|
| MVP | Backend + SQL Server + basic React data grid. No auth, no charts. |
| Phase 2 | Charts (Recharts), collapsible SQL panel, PWA install prompt, improved error handling. |
| Phase 3 | Saved / favourite checks, query history persistence. |
| Phase 4 | Second data source (e.g. PostgreSQL); Claude receives both schemas. |
| Future | Export to CSV/Excel, scheduled QC runs with alerting, feedback-driven prompt tuning. |

See `CLAUDE-MASTER.md` for the full architecture reference and prompt design.
