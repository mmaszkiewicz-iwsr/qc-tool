import { useState } from 'react'
import { postFeedback } from '../services/api'
import type { ChatMessage } from '../types'

interface Props {
  message: ChatMessage
  question: string
}

export default function FeedbackButtons({ message, question }: Props) {
  const [rated, setRated] = useState<'up' | 'down' | null>(null)

  if (!message.response) return null

  async function handleRate(rating: 'up' | 'down') {
    if (rated) return
    setRated(rating)
    await postFeedback({
      messageId: message.id,
      question,
      sql: message.response!.sql,
      rating,
    }).catch(console.error)
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <span className="text-xs text-slate-500">Was this helpful?</span>
      <button
        onClick={() => handleRate('up')}
        disabled={rated !== null}
        className={`text-lg transition-opacity ${rated === 'up' ? 'opacity-100' : rated !== null ? 'opacity-30' : 'hover:opacity-80'}`}
        title="Yes"
        aria-label="Thumbs up"
      >
        👍
      </button>
      <button
        onClick={() => handleRate('down')}
        disabled={rated !== null}
        className={`text-lg transition-opacity ${rated === 'down' ? 'opacity-100' : rated !== null ? 'opacity-30' : 'hover:opacity-80'}`}
        title="No"
        aria-label="Thumbs down"
      >
        👎
      </button>
      {rated && <span className="text-xs text-slate-500">Thanks for the feedback.</span>}
    </div>
  )
}
