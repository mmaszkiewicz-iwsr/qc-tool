import { useState } from 'react'

interface Props {
  sql: string
}

export default function CodePreview({ sql }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-3 border border-slate-700 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-800 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-mono font-semibold tracking-wide text-xs uppercase text-slate-400">
          Generated SQL
        </span>
        <span className="text-slate-500 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <pre className="p-4 bg-slate-900 text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {sql}
        </pre>
      )}
    </div>
  )
}
