export const MessageRole = { User: 'user', Assistant: 'assistant' } as const
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole]

export interface ChatMessage {
  role: MessageRole
  content: string
}
