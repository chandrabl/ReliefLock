import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { WalletButton } from './WalletButton'

export function Navbar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-line)] bg-[var(--color-paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-xl tracking-tight text-[var(--color-ink)]">
          ReliefLock
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-[var(--color-ink-soft)] md:flex">
          <Link to="/campaigns" className="hover:text-[var(--color-ink)]">
            Campaigns
          </Link>
          {user?.role === 'ngo' && (
            <Link to="/ngo" className="hover:text-[var(--color-ink)]">
              NGO Dashboard
            </Link>
          )}
          {user?.role === 'beneficiary' && (
            <Link to="/beneficiary" className="hover:text-[var(--color-ink)]">
              My Aid
            </Link>
          )}
          {user?.role === 'merchant' && (
            <Link to="/merchant" className="hover:text-[var(--color-ink)]">
              Merchant
            </Link>
          )}
        </nav>
        <div className="flex items-center gap-3">
          <WalletButton />
          {user ? (
            <button
              onClick={() => {
                logout()
                navigate('/')
              }}
              className="text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            >
              Sign out
            </button>
          ) : (
            <Link
              to="/login"
              className="rounded-full border border-[var(--color-line)] px-4 py-2 text-sm font-medium hover:border-[var(--color-ink)]"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
