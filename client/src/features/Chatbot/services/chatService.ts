import { API_URL } from '../../../config'

export async function streamChatMessage(
  message: string,
  onChunk: (chunk: string) => void,
): Promise<void> {
  const res = await fetch(`${API_URL}/api/v1/ai/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error('Chat request failed')

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload) as { delta: string }
        onChunk(parsed.delta)
      } catch {
        // incomplete chunk — skip
      }
    }
  }
}
