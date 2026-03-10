# QC Tool — AI-Powered Natural Language Query PWA

## Project Overview

Build a Progressive Web App (PWA) that allows users to ask natural language questions about quality control data stored in a SQL Server database. A Claude AI backend interprets user questions, generates and executes SQL queries, then interprets and presents the results in a clear, human-readable format.

---

## Core User Flow

1. User opens the PWA and types a natural language question (e.g., "How many defects were reported last week by product line?")
2. The frontend sends the question to the backend API
3. The backend sends the question — along with the database schema — to Claude
4. Claude generates a safe, read-only SQL query
5. The backend executes that query against the SQL Server database
6. The results are sent back to Claude, which interprets them and generates a human-readable summary
7. The PWA displays both the summary and (optionally) the raw results and the generated SQL

---

## Application Architecture

### Frontend (PWA)
- Framework: React (Vite) or Next.js with PWA support (via `vite-plugin-pwa` or `next-pwa`)
- Offline-capable with service worker and app manifest
- Installable on desktop and mobile
- Chat-style UI: message thread showing user questions and AI responses
- Optional: collapsible panel showing generated SQL and raw result table
- Responsive design, works on tablet and desktop

### Backend (API Server)
- Node.js with Express or Next.js API routes
- Handles communication between the frontend, Claude API, and SQL Server
- Enforces read-only access to the database (SELECT only)
- Schema introspection: on startup (or on-demand) fetches table/column metadata to include in Claude prompts
- Environment-based config for secrets (API keys, DB connection strings)

### Database
- SQL Server (existing, read-only access)
- The backend fetches schema metadata (tables, columns, data types, relationships) to provide Claude with context
- All queries executed must be SELECT statements only — no INSERT, UPDATE, DELETE, DROP, etc.

### AI Layer (Claude)
- Model: `claude-sonnet-4-6` (default) or `claude-opus-4-6` for complex queries
- Two-turn interaction per user question:
  1. **Query generation turn**: given schema + user question → output a SQL SELECT query
  2. **Result interpretation turn**: given the query + result rows → output a natural language summary
- System prompt instructs Claude to only generate read-only SQL and to refuse unsafe or schema-altering requests

---

## Claude Prompt Design

### System Prompt (Query Generation)
```
You are a SQL Server query assistant for a quality control database.
You will be given the database schema and a user question.
Your job is to generate a single, read-only SQL SELECT query that answers the question.

Rules:
- Only generate SELECT statements. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, EXEC, or any DDL/DML.
- If the question cannot be answered safely with a SELECT query, explain why and do not generate SQL.
- Output ONLY the raw SQL query with no markdown fences, no explanation, no commentary.
- Use proper SQL Server syntax (T-SQL).
- Prefer clarity over cleverness. Use aliases for readability.
- If the question is ambiguous, make a reasonable assumption and note it in a comment above the query.
```

### System Prompt (Result Interpretation)
```
You are a quality control data analyst. You will be given:
1. The user's original question
2. The SQL query that was executed
3. The result set returned by the database

Summarize the results in plain English as if speaking to a non-technical QC manager.
- Highlight key numbers, trends, or anomalies
- If the result set is empty, say so clearly and suggest why
- Do not reproduce the raw data verbatim; interpret it
- produce charts, visualizations and tables as appropriate
- Return the code executed as a validation layer
```
---

## Security Requirements

- **Read-only enforcement**: parse or sanitize generated SQL before execution; reject any statement that is not a SELECT
- **Query timeout**: enforce a maximum execution time (e.g., 30 seconds) on all database queries
- **Row limit**: cap results at a configurable maximum (e.g., 1000 rows) to prevent runaway queries
- **Authentication**: protect the API with user authentication (e.g., Azure AD / MSAL, or simple JWT-based auth)
- **Rate limiting**: limit API calls per user per minute to prevent abuse
- **No schema mutations**: the DB connection string should use a read-only SQL Server login
- **API key security**: Claude API key and DB credentials stored in environment variables, never in client code

---

## Key Features

- Natural language chat interface
- Shows AI-generated summary alongside optional raw result table
- Displays the generated SQL (collapsible, for power users)
- Query history (stored in localStorage or a lightweight backend store)
- PWA install prompt and offline fallback page
- Error handling: clear messages when Claude cannot generate a valid query or the DB returns an error
- Mobile-friendly layout

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React + Vite + `vite-plugin-pwa` (or Next.js) |
| Styling | Tailwind CSS |
| Backend | Node.js + Express (or Next.js API routes) |
| Database client | `mssql` (node-mssql) |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |
| Auth | Azure AD (MSAL) or JWT |
| Hosting | Azure App Service or Azure Static Web Apps + Functions |

---

## Environment Variables

```
ANTHROPIC_API_KEY=
DB_SERVER=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_ENCRYPT=true
JWT_SECRET=           # if using JWT auth
AZURE_CLIENT_ID=      # if using Azure AD
MAX_ROWS=1000
QUERY_TIMEOUT_MS=30000
```

---

## Out of Scope (for initial version)

- Write access to the database
- Multi-database or cross-server queries
- Fine-tuning or training a custom model
- (can be added later)
