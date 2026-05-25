import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useMsal, useIsAuthenticated } from '@azure/msal-react'
import { InteractionStatus, InteractionRequiredAuthError } from '@azure/msal-browser'
import type { User } from '../../types'
import type { AuthContextValue } from './types'
import { API_URL } from '../../config'
import { loginRequest } from '../../config/msalConfig'

// ── Token storage (sync access for existing API services) ─────────────────────

const TOKEN_KEY = 'entra_access_token'

function storeToken(t: string) { sessionStorage.setItem(TOKEN_KEY, t) }
function clearToken()          { sessionStorage.removeItem(TOKEN_KEY)  }

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

// ── User provisioning ─────────────────────────────────────────────────────────

async function fetchUserProfile(accessToken: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/v1/auth/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to load user profile')
  const d = await res.json() as { id: number; email: string; username: string; role: string }
  return { id: d.id, email: d.email, username: d.username, role: d.role as User['role'] }
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Acquire access token silently ───────────────────────────────────────────

  const getToken = useCallback(async (): Promise<string | null> => {
    const account = accounts[0]
    if (!account) return null
    try {
      const result = await instance.acquireTokenSilent({ ...loginRequest, account })
      // Use idToken — its aud = client_id, validated directly by the backend.
      // No API scope required in the user flow.
      const token = result.idToken || result.accessToken
      storeToken(token)
      return token
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        clearToken()
        setUser(null)
      }
      return null
    }
  }, [instance, accounts])

  // ── Restore session when MSAL has an account ────────────────────────────────

  useEffect(() => {
    if (inProgress !== InteractionStatus.None) return
    if (!isAuthenticated || accounts.length === 0) {
      clearToken()
      setUser(null)
      setLoading(false)
      return
    }
    void getToken().then(async (token) => {
      if (!token) { setLoading(false); return }
      try {
        const profile = await fetchUserProfile(token)
        setUser(profile)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    })
  }, [isAuthenticated, inProgress]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Login via MSAL redirect ─────────────────────────────────────────────────
  // Popup flow is blocked by COOP headers sent by Microsoft's login page.

  const login = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    try {
      await instance.loginRedirect(loginRequest)
      return { ok: true } // unreachable — browser navigates away
    } catch (err) {
      console.error('[Auth] login error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      return { ok: false, error: msg }
    }
  }, [instance])

  // ── Logout ──────────────────────────────────────────────────────────────────

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
    void instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin })
  }, [instance])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
