export type ChartHint = 'bar' | 'line' | 'scatter' | 'histogram' | 'none'

export interface QueryResponse {
  summary: string
  columns: ColumnDef[]
  rows: Record<string, unknown>[]
  sql: string
  truncated: boolean
  chartHint: ChartHint
}

export interface ColumnDef {
  field: string
  headerName: string
}

export interface ChatMessage {
  id: string
  type: 'question' | 'answer' | 'error'
  text: string
  response?: QueryResponse
  timestamp: Date
}

export interface FeedbackPayload {
  messageId: string
  question: string
  sql: string
  rating: 'up' | 'down'
}
