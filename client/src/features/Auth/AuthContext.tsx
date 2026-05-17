import { createContext, useContext, useState, type ReactNode } from 'react'
import type { User } from '../../types'
import type { AuthContextValue } from './types'

import { API_URL } from '../../config'

const SESSION_KEY = 'auth_session'

interface StoredSession {
  user: User
  token: string
}

function getStoredSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as StoredSession) : null
  } catch {
    return null
  }
}

export function getStoredToken(): string | null {
  return getStoredSession()?.token ?? null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredSession()?.user ?? null)

  async function login(username: string, password: string): Promise<boolean> {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) return false

      const data = await res.json() as { access_token: string; user: { username: string; role: string } }
      const loggedIn: User = { username: data.user.username, role: data.user.role as User['role'] }
      const session: StoredSession = { user: loggedIn, token: data.access_token }

      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
      setUser(loggedIn)
      return true
    } catch {
      return false
    }
  }

  function logout(): void {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
