import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth, type UserRole } from '@/lib/auth'
import { Field } from './Login'

const roles: { value: UserRole; label: string }[] = [
  { value: 'beneficiary', label: 'Beneficiary' },
  { value: 'ngo', label: 'NGO / Relief Organization' },
  { value: 'merchant', label: 'Merchant' },
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'beneficiary' as UserRole,
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await register(form)
      toast.success('Account created')
      navigate('/')
    } catch {
      toast.error('Could not create account — email may already be in use')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="font-display text-2xl text-[var(--color-ink)]">Create an account</h1>
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <Field label="Full name">
          <input
            required
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="I am a...">
          <div className="grid grid-cols-1 gap-2">
            {roles.map((r) => (
              <button
                type="button"
                key={r.value}
                onClick={() => setForm({ ...form, role: r.value })}
                className={`rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                  form.role === r.value
                    ? 'border-[var(--color-ink)] bg-[var(--color-paper-dim)]'
                    : 'border-[var(--color-line)]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="mt-2 rounded-full bg-[var(--color-ink)] py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-[var(--color-ink-soft)]">
        Already have an account? <Link to="/login" className="text-[var(--color-signal)]">Sign in</Link>
      </p>
    </div>
  )
}
