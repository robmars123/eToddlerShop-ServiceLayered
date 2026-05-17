import * as sdk from 'microsoft-cognitiveservices-speech-sdk'
import { API_URL } from '../config'

async function fetchSpeechToken(): Promise<{ token: string; region: string }> {
  const res = await fetch(`${API_URL}/api/v1/ai/speech-token`)
  if (!res.ok) throw new Error('Failed to get speech token')
  return res.json() as Promise<{ token: string; region: string }>
}

export async function recognizeSpeech(): Promise<string> {
  const { token, region } = await fetchSpeechToken()

  const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region)
  speechConfig.speechRecognitionLanguage = 'en-US'
  const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput()
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig)

  return new Promise((resolve, reject) => {
    recognizer.recognizeOnceAsync(result => {
      recognizer.close()
      if (result.reason === sdk.ResultReason.RecognizedSpeech) {
        resolve(result.text)
      } else {
        reject(new Error('Speech not recognized'))
      }
    })
  })
}
