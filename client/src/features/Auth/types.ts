import type { User } from '../../types'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  login: () => Promise<{ ok: boolean; error?: string }>
  logout: () => void
  getToken: () => Promise<string | null>
}
