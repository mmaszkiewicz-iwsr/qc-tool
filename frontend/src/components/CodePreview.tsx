import { useState } from 'react'

interface Props {
  sql: string
}

export default function CodePreview({ sql }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="font-mono font-semibold tracking-wide text-xs uppercase text-gray-500">
          Generated SQL
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲ hide' : '▼ show'}</span>
      </button>
      {open && (
        <pre className="p-4 bg-gray-900 text-emerald-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
          {sql}
        </pre>
      )}
    </div>
  )
}
