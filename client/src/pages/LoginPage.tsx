import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../features/Auth'
import { Navbar } from '../components/Navbar'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/'
  if (user) return <Navigate to="/" replace />

  async function handleSignIn(): Promise<void> {
    setBusy(true)
    setError('')
    const result = await login()
    setBusy(false)
    if (result.ok) {
      navigate(from, { replace: true })
    } else if (result.error) {
      setError(result.error)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-[#1A1A1A] mb-1">Welcome</h1>
          <p className="text-xs text-gray-400 mb-8">
            Sign in or create an account to continue
          </p>

          {error && (
            <p role="alert" className="text-xs text-red-600 mb-4">{error}</p>
          )}

          <button
            onClick={() => { void handleSignIn() }}
            disabled={busy}
            className="w-full bg-[#1A1A1A] text-white text-xs tracking-widest uppercase py-3 rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50"
          >
            {busy ? 'Redirecting…' : 'Sign in / Create account'}
          </button>

          <p className="mt-4 text-center text-xs text-gray-400">
            You will be redirected to sign in securely.
          </p>
        </div>
      </main>
    </div>
  )
}

export default LoginPage
