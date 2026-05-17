import { useState, type FormEvent, type ChangeEvent } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../features/Auth'
import { Navbar } from '../components/Navbar'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setError('')
    const success = await login(username, password)
    if (success) {
      navigate(from, { replace: true })
    } else {
      setError('Invalid username or password.')
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-[#1A1A1A] mb-6">Sign in</h1>
          <form onSubmit={e => { void handleSubmit(e) }} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-xs tracking-widest uppercase text-gray-500 mb-1.5"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#1A1A1A] transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-xs tracking-widest uppercase text-gray-500 mb-1.5"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-[#1A1A1A] outline-none focus:border-[#1A1A1A] transition-colors"
              />
            </div>
            {error && (
              <p role="alert" className="text-xs text-red-600">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="w-full bg-[#1A1A1A] text-white text-xs tracking-widest uppercase py-3 rounded-lg hover:bg-[#333] transition-colors mt-2"
            >
              Sign in
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}

export default LoginPage
