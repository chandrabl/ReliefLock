import { createContext, useContext, useState, type ReactNode } from 'react'
import { api } from './api'

export type UserRole = 'beneficiary' | 'ngo' | 'program_admin' | 'merchant' | 'platform_admin'

export interface AuthUser {
  id: string
  email: string
  fullName: string
  role: UserRole
}

interface AuthContextValue {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  register: (data: {
    email: string
    password: string
    fullName: string
    role: UserRole
  }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem('rl_user')
    return raw ? (JSON.parse(raw) as AuthUser) : null
  })

  function persist(token: string, u: AuthUser) {
    localStorage.setItem('rl_token', token)
    localStorage.setItem('rl_user', JSON.stringify(u))
    setUser(u)
  }

  async function login(email: string, password: string) {
    const res = await api.post('/auth/login', { email, password })
    persist(res.data.token, res.data.user)
  }

  async function register(data: {
    email: string
    password: string
    fullName: string
    role: UserRole
  }) {
    const res = await api.post('/auth/register', data)
    persist(res.data.token, res.data.user)
  }

  function logout() {
    localStorage.removeItem('rl_token')
    localStorage.removeItem('rl_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
