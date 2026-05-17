import type { User } from '../../types'

export interface AuthContextValue {
  user: User | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
}
