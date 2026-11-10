import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api, configureApi } from '@/api/client'
import type { AuthResponse, User, UserRole } from '@/api/types'
import { readStorage, writeStorage } from '@/lib/storage'

const STORAGE_KEY = 'edupath.session'

interface StoredSession {
  token: string
  expiresAt: string
  user: User
}

function readSession(): StoredSession | null {
  const raw = readStorage(STORAGE_KEY)
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as StoredSession
    return new Date(session.expiresAt).getTime() > Date.now() ? session : null
  } catch {
    return null
  }
}

function writeSession(session: StoredSession | null) {
  writeStorage(STORAGE_KEY, session ? JSON.stringify(session) : null)
}

export interface RegisterInput {
  name: string
  email: string
  password: string
  role: Extract<UserRole, 'Student' | 'Teacher'>
}

interface AuthValue {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthValue | null>(null)

export function homeFor(role: UserRole | undefined) {
  if (role === 'Teacher') return '/teach'
  if (role === 'Admin') return '/admin'
  if (role === 'Student') return '/learn'
  return '/'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<StoredSession | null>(readSession)

  const apply = useCallback(
    (next: StoredSession | null) => {
      writeSession(next)
      setSession(next)
      queryClient.clear()
    },
    [queryClient],
  )

  const logout = useCallback(() => apply(null), [apply])

  configureApi({ token: () => session?.token ?? null, onUnauthorized: logout })

  const fromResponse = useCallback(
    (response: AuthResponse) => {
      apply({ token: response.accessToken, expiresAt: response.expiresAt, user: response.user })
      return response.user
    },
    [apply],
  )

  const login = useCallback(
    async (email: string, password: string) => fromResponse(await api.post<AuthResponse>('/auth/login', { email, password })),
    [fromResponse],
  )

  const register = useCallback(
    async (input: RegisterInput) => fromResponse(await api.post<AuthResponse>('/auth/register', input)),
    [fromResponse],
  )

  const updateUser = useCallback((user: User) => {
    setSession((current) => {
      if (!current) return current
      const next = { ...current, user }
      writeSession(next)
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, login, register, logout, updateUser }),
    [session, login, register, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
