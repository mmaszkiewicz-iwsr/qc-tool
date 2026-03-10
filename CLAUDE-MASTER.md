# QC Tool — AI-Powered Natural Language Query PWA

**Elevator pitch:** Ask plain-English questions about QC data; Claude writes the query, runs it, and explains the results — with charts and tables included.

---

## Core User Flow

1. User types a natural language question (e.g., "Which records have a null value in column X?")
2. Frontend sends the question + active schema to the Node.js backend
3. Backend calls Claude with the question and schema context
4. Claude returns a structured JSON response: `{ "sql": "...", "summary": "...", "chartHint": "..." }`
5. Backend validates the SQL (SELECT only), executes it against SQL Server, and enforces row/timeout limits
6. Results (rows + column metadata) are returned to the frontend
7. Frontend displays: AI summary, data grid, optional chart, and collapsible SQL preview
8. Interpret the results to add insight to the query, if there is no data coming back then try to explain why.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + `vite-plugin-pwa` |
| Styling | Tailwind CSS |
| Data grid | AG Grid (Community) |
| Charts | Recharts |
| Backend | Node.js + Express |
| Database client | `mssql` (node-mssql) |
| AI | Anthropic SDK (`@anthropic-ai/sdk`) |
| Auth | Azure AD (MSAL) or JWT |
| Hosting | Azure App Service + Azure Static Web Apps |

---

## Application Architecture

### Frontend (PWA)
- Installable on desktop and mobile via service worker + app manifest
- Chat-style UI: message thread of questions and AI responses
- Each response includes: plain-English summary, AG Grid data table, optional Recharts chart, collapsible SQL panel
- Offline fallback page when disconnected
- Query history in localStorage

### Backend (Node.js + Express)
- Single API endpoint: `POST /api/query`
- Loads and caches schema metadata from SQL Server on startup
- Calls Claude with schema + question; parses the structured JSON response
- Validates and executes the SQL; enforces row cap and timeout
- Returns `{ summary, columns, rows, sql, truncated, chartHint }` to the frontend
- Stateless per request — schema context is injected into every Claude call; no reliance on conversation history

### Database (SQL Server)
- Read-only login; no write permissions at the connection level
- Schema introspection on startup: table names, column names, data types, foreign key relationships
- All executed statements must be `SELECT` only

### AI Layer (Claude)
- Model: `claude-sonnet-4-6` (default); `claude-opus-4-6` for complex multi-table checks
- Single-turn structured response — Claude returns one JSON object per request (no multi-turn)
- System prompt is rebuilt on every request with the current schema context

---

## Claude Prompt Design

### System Prompt
```
You are a SQL Server query assistant for a quality control database.
The user is performing QC checks on the following schema:

[SCHEMA_CONTEXT]

When the user asks a question:
1. Write a single, read-only SQL SELECT statement (T-SQL syntax) to answer it.
2. Return ONLY a JSON object in this exact shape — no markdown fences, no text outside the JSON:

{
  "sql": "SELECT ...",
  "summary": "One-sentence plain English description of what the check does.",
  "chartHint": "bar | line | scatter | histogram | none"
}

Rules:
- Only SELECT statements. Never use INSERT, UPDATE, DELETE, DROP, ALTER, EXEC, or any DDL/DML.
- If the question cannot be answered with a safe SELECT query, return:
  { "sql": null, "summary": "Explanation of why the question cannot be answered.", "chartHint": "none" }
- Use aliases for readability. Prefer clarity over cleverness.
- If the question is ambiguous, make a reasonable assumption and reflect it in the summary.
```

### Result Interpretation (second call after execution)
```
You are a quality control data analyst. You will be given:
1. The user's original question
2. The SQL query that was executed
3. The result set (as JSON rows)

Respond in plain English as if speaking to a non-technical QC manager:
- Highlight key numbers, trends, or anomalies
- If the result set is empty, say so clearly and suggest a likely reason
- Interpret the data — do not reproduce raw rows verbatim
- Return the executed SQL as a validation reference at the end of your response
- Suggest a chart type if the data would be better understood visually
```

---

## QC Check Types

Claude should handle questions mapping to these categories:

| Check Type | Example Question |
|---|---|
| Null / missing value | "Which records have a null value in column X?" |
| Range / plausibility | "Are there any ages outside 0–120?" |
| Referential integrity | "Are there child records with no matching parent?" |
| Duplicate detection | "Show me any duplicate case IDs" |
| Distribution | "What's the distribution of values in column X?" |
| Cross-field consistency | "Flag records where start date is after end date" |
| Count / volume | "How many records are in table X this week vs last week?" |
| Comparison | "Where does the published value differ from source by more than 5%?" |

---

## Security Requirements

- **Read-only enforcement**: parse the Claude-generated SQL before execution; reject any statement containing `INSERT`, `UPDATE`, `DELETE`, `DROP`, `EXEC`, `ALTER`, or multiple statements (`;` mid-string)
- **Query timeout**: hard limit of 30 seconds per execution (`QUERY_TIMEOUT_MS`)
- **Row cap**: return at most 1,000 rows; include `truncated: true` in the response if hit (`MAX_ROWS`)
- **Authentication**: Azure AD (MSAL) or JWT — protect all `/api/*` routes
- **Rate limiting**: limit API calls per authenticated user per minute
- **Read-only DB login**: the SQL Server connection string uses a login with SELECT-only permissions
- **Secret management**: all credentials in environment variables; never in client-side code or committed to source control

---

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│  [Dataset / connection status]   [Install PWA]        │
├────────────────┬─────────────────────────────────────┤
│                │  AI Summary                          │
│  Chat /        │  ─────────────────────────────────  │
│  Question      │  DataGrid (AG Grid)                  │
│  History       │                                      │
│                │  [Toggle: Table | Chart]             │
│                ├─────────────────────────────────────┤
│  [Ask ▶]       │  Generated SQL (collapsible)         │
└────────────────┴─────────────────────────────────────┘
```

- Chart type follows `chartHint` from Claude: bar/histogram for distributions, line for time-series, scatter for comparisons
- The SQL panel is visible but collapsed by default — transparency builds user trust
- Each response includes a thumbs-up / thumbs-down for feedback

---

## Project Structure

```
/qc-tool
  /frontend                     # React + Vite PWA
    /src
      /components
        ChatPanel.tsx
        ResultsGrid.tsx         # AG Grid wrapper
        ChartView.tsx           # Recharts wrapper
        CodePreview.tsx         # Collapsible SQL panel
        FeedbackButtons.tsx
      /services
        api.ts                  # fetch calls to Express backend
      App.tsx
    vite.config.ts
    manifest.json
    service-worker.ts
  /backend                      # Node.js + Express
    server.ts                   # Express entry point
    routes/query.ts             # POST /api/query
    services/claude.ts          # Anthropic SDK client + prompt builder
    services/database.ts        # mssql connection + query execution
    services/schema.ts          # SQL Server schema introspection
    middleware/auth.ts
    middleware/rateLimit.ts
  .env                          # Never committed
  package.json
  tsconfig.json
  CLAUDE-MASTER.md
  README.md
```

---

## Environment Variables

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
AZURE_CLIENT_ID=
AZURE_TENANT_ID=
```

---

## Development Priorities

1. **MVP**: Backend connects to SQL Server, answers a freetext question, returns rows to a basic React data grid. No auth, no charts.
2. **Phase 2**: Chart output (Recharts), collapsible SQL panel, improved error handling, PWA install prompt.
3. **Phase 3**: Saved / favourite checks (replicate named PQT check patterns). Query history.
4. **Phase 4**: Second data source (e.g., PostgreSQL published dataset) for comparison queries; Claude receives both schemas when both connections are active.
5. **Future**: Export to Excel/CSV, scheduled QC runs with alerting, thumbs-up/down feedback dataset for prompt tuning.

---

## Development Notes

- **Test the backend independently**: run `npx ts-node backend/server.ts` (or `nodemon`) and call it from Postman before wiring up the frontend.
- **Stateless prompts**: schema context must be present in every Claude request — do not rely on conversation history.
- **Audit log**: log all generated SQL and execution results with timestamps for traceability.
- **Feedback loop**: store thumbs-up/down ratings against the (question, sql, summary) triple for future prompt tuning.
