import { useState } from 'react'
import { recognizeSpeech } from '../../../services/speechService'

export function useSpeech(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startListening(): Promise<void> {
    if (listening) return
    setListening(true)
    setError(null)
    try {
      const text = await recognizeSpeech()
      onResult(text)
    } catch {
      setError('Could not recognize speech. Please try again.')
    } finally {
      setListening(false)
    }
  }

  return { listening, error, startListening }
}
