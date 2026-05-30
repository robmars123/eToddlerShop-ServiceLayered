import { useState, useRef, useEffect } from 'react'
import { fetchChatHistory, streamChatMessage } from '../services/chatService'
import { MessageRole, type ChatMessage } from '../types'
import { useAuth } from '../../Auth/AuthContext'

// Guest session persists across page refreshes; replaced on login by user-scoped key.
function getOrCreateGuestSessionId(): string {
  const key = 'guest_chat_session'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

export function useChat() {
  const { user } = useAuth()

  // Logged-in users are keyed by their DB id; guests get a stable localStorage UUID.
  const sessionId = user ? `user-${user.id}` : getOrCreateGuestSessionId()

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)   // true while waiting for first chunk
  const [streaming, setStreaming] = useState(false) // true while chunks are arriving
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Restore conversation from Redis on mount.
  useEffect(() => {
    fetchChatHistory(sessionId).then(setMessages)
  }, [sessionId])

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
      await streamChatMessage(text, sessionId, (chunk) => {
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
