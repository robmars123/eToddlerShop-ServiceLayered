/**
 * Unit tests for ProtectedRoute.
 *
 * Covers the three branching conditions:
 *   loading → render nothing
 *   no user → redirect to /login
 *   wrong role → redirect to /
 *   correct role → render children
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'

// Control useAuth output per test without spinning up a real MSAL context.
vi.mock('../../features/Auth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../../features/Auth'
import type { AuthContextValue } from '../../features/Auth'

const mockUseAuth = vi.mocked(useAuth)

function auth(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    getToken: vi.fn(),
    ...overrides,
  }
}

// Renders ProtectedRoute inside a router; exposes what ended up on screen.
function renderRoute(element: React.ReactElement, startPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[startPath]}>
      <Routes>
        <Route path="/protected" element={element} />
        <Route path="/login" element={<div>login page</div>} />
        <Route path="/" element={<div>home page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('renders nothing while auth is loading', () => {
    mockUseAuth.mockReturnValue(auth({ loading: true }))

    const { container } = renderRoute(
      <ProtectedRoute><div>secret</div></ProtectedRoute>,
    )

    expect(container.firstChild).toBeNull()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('redirects to /login when user is not authenticated', () => {
    mockUseAuth.mockReturnValue(auth({ user: null }))

    renderRoute(<ProtectedRoute><div>secret</div></ProtectedRoute>)

    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(screen.queryByText('secret')).not.toBeInTheDocument()
  })

  it('renders children when user is authenticated and no role is required', () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: 1, email: 'u@u.com', username: 'Alice', role: 'user' } }))

    renderRoute(<ProtectedRoute><div>secret</div></ProtectedRoute>)

    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  it('renders children when user has the required role', () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: 1, email: 'a@a.com', username: 'Admin', role: 'admin' } }))

    renderRoute(
      <ProtectedRoute requiredRole="admin"><div>admin panel</div></ProtectedRoute>,
    )

    expect(screen.getByText('admin panel')).toBeInTheDocument()
  })

  it('redirects to / when user role does not match requiredRole', () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: 2, email: 'u@u.com', username: 'Bob', role: 'user' } }))

    renderRoute(
      <ProtectedRoute requiredRole="admin"><div>admin panel</div></ProtectedRoute>,
    )

    expect(screen.getByText('home page')).toBeInTheDocument()
    expect(screen.queryByText('admin panel')).not.toBeInTheDocument()
  })
})
