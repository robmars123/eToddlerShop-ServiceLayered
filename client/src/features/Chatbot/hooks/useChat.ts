import { useState, useRef, useEffect } from 'react'
import { sendChatMessage } from '../services/chatService'
import { MessageRole, type ChatMessage } from '../types'

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(): Promise<void> {
    const text = input.trim()
    if (!text || loading) return
    setMessages(prev => [...prev, { role: MessageRole.User, content: text }])
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const reply = await sendChatMessage(text)
      setMessages(prev => [...prev, { role: MessageRole.Assistant, content: reply }])
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return { messages, input, setInput, loading, error, send, bottomRef }
}
