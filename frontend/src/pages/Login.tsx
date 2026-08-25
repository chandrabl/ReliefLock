import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/lib/auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Signed in')
      navigate('/')
    } catch {
      toast.error('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-2xl text-[var(--color-ink)]">Sign in</h1>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-ink-soft)]">
        No account? <Link to="/register" className="text-[var(--color-signal)]">Register</Link>
      </p>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      {children}
    </label>
  )
}
