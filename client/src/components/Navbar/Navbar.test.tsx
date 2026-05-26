/**
 * Unit tests for Navbar.
 *
 * Auth and cart state are injected via mocks so the component
 * can be tested without MSAL or a real cart store.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Navbar } from './Navbar'

vi.mock('../../features/Auth', () => ({ useAuth: vi.fn() }))
vi.mock('../Cart/CartStore', () => ({ useCart: vi.fn() }))

import { useAuth } from '../../features/Auth'
import { useCart } from '../Cart/CartStore'
import type { AuthContextValue } from '../../features/Auth'

const mockUseAuth = vi.mocked(useAuth)
const mockUseCart = vi.mocked(useCart)

// useCart only exposes totalCount to the Navbar.
const cart = (totalCount = 0) => ({ totalCount } as ReturnType<typeof useCart>)

function auth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return { user: null, loading: false, login: vi.fn(), logout: vi.fn(), getToken: vi.fn(), ...overrides }
}

const renderNavbar = () =>
  render(<MemoryRouter><Navbar /></MemoryRouter>)

describe('Navbar — unauthenticated', () => {
  it('shows a Sign in link', () => {
    mockUseAuth.mockReturnValue(auth())
    mockUseCart.mockReturnValue(cart())

    renderNavbar()

    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.queryByText(/sign out/i)).not.toBeInTheDocument()
  })
})

describe('Navbar — authenticated user', () => {
  it('shows the username', () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: 1, email: 'a@b.com', username: 'Alice', role: 'user' } }))
    mockUseCart.mockReturnValue(cart())

    renderNavbar()

    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('shows a Sign out button', () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: 1, email: 'a@b.com', username: 'Alice', role: 'user' } }))
    mockUseCart.mockReturnValue(cart())

    renderNavbar()

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('calls logout when Sign out is clicked', async () => {
    const logout = vi.fn()
    mockUseAuth.mockReturnValue(auth({ user: { id: 1, email: 'a@b.com', username: 'Alice', role: 'user' }, logout }))
    mockUseCart.mockReturnValue(cart())

    renderNavbar()
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(logout).toHaveBeenCalledOnce()
  })

  it('does not show the Admin link for a regular user', () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: 1, email: 'a@b.com', username: 'Alice', role: 'user' } }))
    mockUseCart.mockReturnValue(cart())

    renderNavbar()

    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument()
  })
})

describe('Navbar — admin user', () => {
  it('shows the Admin nav link', () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: 2, email: 'boss@b.com', username: 'Boss', role: 'admin' } }))
    mockUseCart.mockReturnValue(cart())

    renderNavbar()

    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument()
  })
})

describe('Navbar — cart badge', () => {
  it('shows the item count when cart is non-empty', () => {
    mockUseAuth.mockReturnValue(auth())
    mockUseCart.mockReturnValue(cart(3))

    renderNavbar()

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('hides the badge when cart is empty', () => {
    mockUseAuth.mockReturnValue(auth())
    mockUseCart.mockReturnValue(cart(0))

    renderNavbar()

    // Badge span is only rendered when totalCount > 0
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })
})
