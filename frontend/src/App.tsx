import { useState, useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import ChatPanel from './components/ChatPanel'
import { postQuery } from './services/api'
import type { ChatMessage } from './types'

function generateId() {
  return Math.random().toString(36).slice(2)
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('qc-history')
      return stored ? (JSON.parse(stored) as ChatMessage[]) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev, msg]
      try {
        localStorage.setItem('qc-history', JSON.stringify(next.slice(-100)))
      } catch {
        // quota exceeded — ignore
      }
      return next
    })
  }, [])

  async function handleSubmit(question: string) {
    addMessage({ id: generateId(), type: 'question', text: question, timestamp: new Date() })
    setLoading(true)
    try {
      const response = await postQuery(question)
      addMessage({
        id: generateId(),
        type: 'answer',
        text: response.summary,
        response,
        timestamp: new Date(),
      })
    } catch (err) {
      addMessage({
        id: generateId(),
        type: 'error',
        text: err instanceof Error ? err.message : 'An unexpected error occurred.',
        timestamp: new Date(),
      })
    } finally {
      setLoading(false)
    }
  }

  function clearHistory() {
    setMessages([])
    localStorage.removeItem('qc-history')
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="font-bold text-blue-400 tracking-tight">QC Tool</span>
          <span className="text-xs text-slate-500 hidden sm:inline">AI-powered quality control queries</span>
        </div>
        <div className="flex items-center gap-2">
          {needRefresh && (
            <button
              onClick={() => updateServiceWorker(true)}
              className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
            >
              Update available — reload
            </button>
          )}
          <button
            onClick={clearHistory}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1"
            title="Clear conversation history"
          >
            Clear
          </button>
          <InstallButton />
        </div>
      </header>

      {/* Main content — full height, no sidebar for MVP */}
      <main className="flex-1 min-h-0">
        <ChatPanel messages={messages} loading={loading} onSubmit={handleSubmit} />
      </main>
    </div>
  )
}

function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useState(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  })

  if (!prompt) return null

  return (
    <button
      onClick={async () => {
        await prompt.prompt()
        setPrompt(null)
      }}
      className="text-xs bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded transition-colors"
    >
      Install PWA
    </button>
  )
}

// Browser type not in TS lib by default
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}
