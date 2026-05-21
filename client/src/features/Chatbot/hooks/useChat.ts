import { useState, useRef, useEffect } from 'react'
import { streamChatMessage } from '../services/chatService'
import { MessageRole, type ChatMessage } from '../types'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)   // true while waiting for first chunk
  const [streaming, setStreaming] = useState(false) // true while chunks are arriving
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(): Promise<void> {
    const text = input.trim()
    if (!text || loading || streaming) return

    setMessages(prev => [...prev, { role: MessageRole.User, content: text }])
    setInput('')
    setLoading(true)
    setError(null)

    let firstChunk = true

    try {
      await streamChatMessage(text, (chunk) => {
        if (firstChunk) {
          firstChunk = false
          setLoading(false)
          setStreaming(true)
          setMessages(prev => [...prev, { role: MessageRole.Assistant, content: chunk }])
        } else {
          setMessages(prev => {
            const next = [...prev]
            const last = next[next.length - 1]
            next[next.length - 1] = { ...last, content: last.content + chunk }
            return next
          })
        }
      })
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  return { messages, input, setInput, loading, streaming, error, send, bottomRef }
}
