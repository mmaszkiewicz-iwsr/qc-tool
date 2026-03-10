import { useState, useRef, useEffect } from 'react'
import type { ChatMessage, QueryResponse } from '../types'
import ResultsGrid from './ResultsGrid'
import ChartView from './ChartView'
import CodePreview from './CodePreview'
import FeedbackButtons from './FeedbackButtons'

interface Props {
  messages: ChatMessage[]
  loading: boolean
  onSubmit: (question: string) => void
}

export default function ChatPanel({ messages, loading, onSubmit }: Props) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function submit() {
    const val = inputRef.current?.value.trim()
    if (!val || loading) return
    onSubmit(val)
    inputRef.current!.value = ''
  }

  function getQuestion(index: number): string {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i].type === 'question') return messages[i].text
    }
    return ''
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 mt-16 space-y-2">
            <p className="text-2xl">Ask a QC question</p>
            <p className="text-sm">e.g. "Which records have a null value in column X?"</p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.type === 'question') {
            return (
              <div key={msg.id} className="flex justify-end">
                <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 text-sm">
                  {msg.text}
                </div>
              </div>
            )
          }

          if (msg.type === 'error') {
            return (
              <div key={msg.id} className="flex justify-start">
                <div className="max-w-[80%] bg-red-900/40 border border-red-700 text-red-300 rounded-2xl rounded-tl-sm px-4 py-2 text-sm">
                  {msg.text}
                </div>
              </div>
            )
          }

          const res = msg.response
          if (!res) return null

          return (
            <div key={msg.id} className="space-y-2">
              <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <p className="text-sm text-slate-200 leading-relaxed">{res.summary}</p>
              </div>
              {res.rows.length > 0 && <AnswerTabs res={res} />}
              <CodePreview sql={res.sql} />
              <FeedbackButtons message={msg} question={getQuestion(i)} />
            </div>
          )
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-tl-sm px-5 py-3">
              <span className="flex gap-1 items-center text-slate-400 text-sm">
                <span className="animate-bounce [animation-delay:0ms]">●</span>
                <span className="animate-bounce [animation-delay:150ms]">●</span>
                <span className="animate-bounce [animation-delay:300ms]">●</span>
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-slate-700 p-4">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            rows={2}
            placeholder="Ask a QC question… (Enter to send, Shift+Enter for newline)"
            onKeyDown={handleKeyDown}
            disabled={loading}
            className="flex-1 resize-none rounded-xl bg-slate-800 border border-slate-600 text-slate-100 text-sm px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={submit}
            disabled={loading}
            className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
          >
            Ask ▶
          </button>
        </div>
      </div>
    </div>
  )
}

function AnswerTabs({ res }: { res: QueryResponse }) {
  const [tab, setTab] = useState<'table' | 'chart'>('table')
  const showChart = res.chartHint !== 'none'

  return (
    <div className="rounded-xl border border-slate-700 overflow-hidden">
      {showChart && (
        <div className="flex border-b border-slate-700 bg-slate-800">
          {(['table', 'chart'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-xs font-medium capitalize transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="p-3 bg-slate-900">
        {tab === 'table' ? (
          <ResultsGrid columns={res.columns} rows={res.rows} truncated={res.truncated} />
        ) : (
          <ChartView chartHint={res.chartHint} columns={res.columns} rows={res.rows} />
        )}
      </div>
    </div>
  )
}
