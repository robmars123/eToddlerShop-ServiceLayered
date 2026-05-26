import { Link } from 'react-router-dom'
import { useCart } from '../Cart/CartStore'
import { useAuth } from '../../features/Auth'
import { Role } from '../../types'

interface NavLink {
  label: string
  to: string
}

const NAV_LINKS: NavLink[] = [
  { label: 'Shop', to: '/' },
  { label: 'AI Search', to: '/recommend' },
 // { label: 'Best Sellers', to: '#' },
 // { label: 'Girl', to: '#' },
 // { label: 'Boy', to: '#' },
 // { label: 'Clearance', to: '#' },
]

export function Navbar() {
  const { totalCount } = useCart()
  const { user, logout } = useAuth()
  const isAdmin = user?.role === Role.Admin

  return (
    <header className="border-b border-gray-100 sticky top-0 z-10 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link
          to="/"
          className="text-base font-semibold tracking-[0.2em] uppercase text-[#1A1A1A] hover:opacity-70 transition-opacity"
        >
          eToddlerShop
        </Link>

        {/* Nav links — centered via absolute positioning on larger screens */}
        <nav
          className="hidden md:flex items-center gap-8 text-xs tracking-widest uppercase text-gray-500
                     md:absolute md:left-1/2 md:-translate-x-1/2"
          aria-label="Main navigation"
        >
          {NAV_LINKS.map(({ label, to }) => (
            <Link key={label} to={to} className="hover:text-[#1A1A1A] transition-colors">
              {label}
            </Link>
          ))}
          {isAdmin && (
            <Link to="/admin" className="text-[#D4513A] hover:text-red-800 transition-colors">
              Admin
            </Link>
          )}
        </nav>

        {/* Right side: cart + auth */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-xs tracking-widest uppercase text-[#1A1A1A] font-medium">
                {user.username}
              </span>
              <button
                onClick={logout}
                className="text-xs tracking-widest uppercase text-gray-500 hover:text-[#1A1A1A] transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:block text-xs tracking-widest uppercase text-gray-500 hover:text-[#1A1A1A] transition-colors"
            >
              Sign in
            </Link>
          )}

          {/* Cart */}
          <Link
            to="/cart"
            className="flex items-center gap-2 text-xs tracking-widest uppercase text-gray-500 hover:text-[#1A1A1A] transition-colors"
            aria-label={`Cart, ${totalCount} item${totalCount !== 1 ? 's' : ''}`}
          >
            <div className="relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
              {totalCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-[#D4513A] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center leading-none">
                  {totalCount > 99 ? '99+' : totalCount}
                </span>
              )}
            </div>
            Cart
          </Link>
        </div>
      </div>
    </header>
  )
}

export default Navbar
