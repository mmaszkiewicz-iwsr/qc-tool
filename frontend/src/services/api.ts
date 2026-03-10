import type { QueryResponse, FeedbackPayload } from '../types'

const BASE = '/api'

export async function postQuery(question: string): Promise<QueryResponse> {
  const res = await fetch(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })

  const body = await res.json().catch(() => ({})) as Record<string, unknown>

  if (!res.ok) {
    throw new Error((body.error ?? body.message ?? `HTTP ${res.status}`) as string)
  }

  // Backend returns columns as string[] — map to ColumnDef[]
  const raw = body as Omit<QueryResponse, 'columns'> & { columns: string[] }
  return {
    ...raw,
    columns: raw.columns.map((field) => ({
      field,
      headerName: field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    })),
  }
}

export async function postFeedback(payload: FeedbackPayload): Promise<void> {
  await fetch(`${BASE}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}
