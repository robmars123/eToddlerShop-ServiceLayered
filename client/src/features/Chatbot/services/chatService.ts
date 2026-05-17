import { API_URL } from '../../../config'

export async function sendChatMessage(message: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/v1/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) throw new Error('Chat request failed')
  const data = await res.json() as { message: string }
  return data.message
}
