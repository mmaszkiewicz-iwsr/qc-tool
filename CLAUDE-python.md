# CLAUDE.md — AI-Powered QC Tool

## Project Overview

An AI-powered Quality Control desktop application that embeds Claude to allow users to ask natural-language data verification questions. Claude generates and executes code to answer those questions, presenting results in data grids and charts within the app.

**Elevator pitch:** PQT meets ChatGPT — conversational, ad hoc data QC backed by Claude's code generation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | [Electron](https://www.electronjs.org/) |
| Frontend | TypeScript + React |
| Backend / execution engine | Python (FastAPI) |
| IPC | React UI ↔ Python via local HTTP |
| AI backend | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Primary data source | DBE01 |
| Future data source | PostgreSQL (for comparison with published datasets) |

### Why this split

- **TypeScript/React** handles the UI — chat panel, data grid, charts. Rich ecosystem (AG Grid, Recharts, etc.).
- **Python backend** handles data access and executes Claude-generated code. Python's data stack (pandas, SQLAlchemy, psycopg2) is well-suited to QC work, and generated pandas/SQL code is straightforward to sandbox.
- Electron wraps both into a single distributable desktop app, spawning the Python process on launch.

---

## Architecture

### Core Flow

```
User types question
       ↓
React UI sends question + active schema to Python backend
       ↓
Python calls Claude API with question + schema context
       ↓
Claude returns { code, language, summary }
       ↓
Python executes the generated SQL or pandas code
       ↓
Results (JSON rows + column metadata) returned to React UI
       ↓
Displayed in DataGrid and/or Chart
```

### Key Components

- **Chat Panel** (React/TS) — User input for ad hoc QC questions
- **Results Panel** (React/TS) — AG Grid data table + Recharts chart, toggle between views
- **Code Preview** (React/TS) — Collapsible panel showing Claude-generated code
- **Python Execution Service** — Receives questions, calls Claude, runs generated code, returns results
- **Schema Introspection** (Python) — Reads DBE01/Postgres metadata on startup; passed to Claude as context

---

## Claude Integration

### System Prompt Strategy

Inject the following context into every Claude request:

- Active data source schema (table names, column names, types, row counts)
- Current QC domain (which dataset is loaded)
- Output format instructions: return **only** a JSON object, no markdown fences
- Safety constraints: no destructive operations (`DELETE`, `DROP`, `UPDATE`, `INSERT`)
- Target language: `sql` (preferred for simple filters/aggregations) or `python` (for pandas, complex transforms)

### Prompt Pattern

```
System:
  You are a data quality assistant. The user is performing QC checks on [DATASET].
  Available schema: [SCHEMA_CONTEXT]

  When the user asks a question:
  1. Write a SQL SELECT statement or Python (pandas) snippet to answer it.
  2. Return ONLY a JSON object in this exact shape:
     { "code": "...", "language": "sql|python", "summary": "..." }
  - "summary" is a one-sentence plain English description of what the check does.
  - Never use DELETE, DROP, UPDATE, or INSERT.
  - Never include markdown fences or any text outside the JSON.

User:
  [USER_QUESTION]
```

### Model

Use `claude-sonnet-4-20250514` for the balance of speed and code quality. Switch to `claude-opus-4-20250514` for complex multi-table checks if needed.

---

## Data Sources

### Phase 1 — DBE01

- Python backend connects to DBE01 via SQLAlchemy
- Schema metadata loaded on startup and injected into every Claude prompt
- Target QC check types from PQT (see below)

### Phase 2 — PostgreSQL

- Add a second connection profile for the published/Postgres dataset
- Allow side-by-side comparison queries (DBE01 value vs published value)
- Claude receives both schemas when both connections are active

---

## QC Check Types (replicating PQT patterns)

Claude should be able to handle questions that map to these categories:

| Check Type | Example Question |
|---|---|
| Null / missing value checks | "Which records have a null value in column X?" |
| Range / plausibility checks | "Are there any ages outside 0–120?" |
| Referential integrity | "Are there child records with no matching parent?" |
| Duplicate detection | "Show me any duplicate case IDs" |
| Distribution checks | "What's the distribution of values in column X?" |
| Cross-field consistency | "Flag records where start date is after end date" |
| Count / record volume | "How many records are in table X this week vs last week?" |
| Published vs source comparison | "Where does the published value differ from DBE01 by more than 5%?" |

---

## Code Execution Safety

Claude-generated code runs in the Python backend — treat it with care:

- **SQL:** Parse the statement before execution; reject anything containing `INSERT`, `UPDATE`, `DELETE`, `DROP`, `EXEC`, or multiple statements (`;` mid-string).
- **Python:** Run in a subprocess with a whitelist of allowed imports (`pandas`, `numpy`, `datetime`). Block `os`, `subprocess`, `open`, `eval`, `exec`.
- **Timeout:** Hard limit of 30 seconds per execution.
- **Row cap:** Return at most 10,000 rows to the UI; include a `truncated: true` flag in the response if hit.

---

## UI Layout (Suggested)

```
┌─────────────────────────────────────────────────┐
│  [Dataset selector]  [Connection status]         │
├──────────────┬──────────────────────────────────┤
│              │  DataGrid / Chart                 │
│  Chat /      │                                   │
│  Question    │  [Toggle: Table | Chart]          │
│  Panel       │                                   │
│              ├──────────────────────────────────┤
│  [Ask]       │  Generated code (collapsible)     │
└──────────────┴──────────────────────────────────┘
```

- The generated code panel should be visible but collapsible — transparency helps users trust the output.
- Charts: default to bar/histogram for distributions, line for time-series, scatter for comparisons.

---

## Project Structure

```
/qc-tool
  /electron                 # Electron main process (TypeScript)
    main.ts                 # App entry, spawns Python backend
    preload.ts
  /renderer                 # React/TypeScript frontend
    /components
      ChatPanel.tsx
      ResultsGrid.tsx
      ChartView.tsx
      CodePreview.tsx
    /services
      api.ts                # HTTP calls to Python backend
    App.tsx
  /backend                  # Python execution service
    main.py                 # FastAPI app entry
    claude_service.py       # Claude API client + prompt builder
    execution.py            # SQL + pandas code runner
    schema.py               # DBE01/Postgres schema introspection
    requirements.txt
  /shared                   # Shared type definitions / JSON schemas
  package.json
  tsconfig.json
  CLAUDE.md
  README.md
```

---

## Environment & Configuration

Use a `.env` file at the project root (never commit it):

```env
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-4-20250514
DBE01_CONNECTION_STRING=
POSTGRES_CONNECTION_STRING=
```

The Electron main process passes these to the Python subprocess via environment variables on launch.

---

## Development Workflow

The Python backend can be developed and tested **independently of Electron** — run it standalone with `uvicorn backend.main:app --reload` during development and call it from a browser or Postman. Only wire it into Electron once the backend is stable.

Similarly, the React frontend can be developed against a mock backend before the real one is ready.

---

## Development Priorities

1. **MVP:** Python backend connects to DBE01, answers a freetext question, returns rows to a basic React data grid
2. **Phase 2:** Chart output, collapsible generated-code panel, improved error messages when Claude's code fails to execute
3. **Phase 3:** Saved/favourite checks (replicating named PQT checks)
4. **Phase 4:** Postgres second source + comparison queries
5. **Future:** Export results to Excel/CSV, scheduled QC runs, alerting

---

## Notes

- Keep Claude prompts **stateless per question** — don't rely on conversation history for code generation; schema context must always be present in every request.
- Log all generated code and execution results (with timestamps) for audit purposes.
- Consider a "thumbs up / thumbs down" on each answer to build a feedback dataset for later prompt tuning.
