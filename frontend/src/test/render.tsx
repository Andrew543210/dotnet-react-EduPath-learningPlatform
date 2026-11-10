import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import type { User, UserRole } from '@/api/types'
import { createQueryClient, Providers } from '@/app/Providers'
import { RouteRoot } from '@/app/layout/Layouts'
import type { Language } from '@/i18n/I18nProvider'

export function fakeUser(role: UserRole, overrides: Partial<User> = {}): User {
  return {
    id: 1,
    name: 'Софія Ткаченко',
    email: `${role.toLowerCase()}@edupath.dev`,
    role,
    headline: null,
    bio: null,
    isBlocked: false,
    createdAt: '2026-01-01T00:00:00Z',
    lastLoginAt: null,
    ...overrides,
  }
}

export function signIn(role: UserRole) {
  const user = fakeUser(role)
  localStorage.setItem(
    'edupath.session',
    JSON.stringify({ token: 'test-token', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user }),
  )
  return user
}

export function renderRoutes(routes: RouteObject[], { path = '/', language = 'uk' as Language } = {}) {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { retry: false } })
  const router = createMemoryRouter([{ element: <RouteRoot />, children: routes }], { initialEntries: [path] })
  const result = render(
    <Providers language={language} client={client}>
      <RouterProvider router={router} />
    </Providers>,
  )
  return { ...result, router }
}

export function renderPage(element: ReactNode, options?: { path?: string; language?: Language }) {
  return renderRoutes([{ path: '*', element }], options)
}

export function mockFetch(handlers: Record<string, (body: unknown) => { status?: number; body?: unknown }>) {
  const calls: { method: string; path: string; body: unknown }[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost')
    const method = init?.method ?? 'GET'
    const path = url.pathname.replace(/^\/api/, '')
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body })
    const handler = handlers[`${method} ${path}`]
    if (!handler) return new Response(JSON.stringify({ title: 'Not mocked' }), { status: 404 })
    const { status = 200, body: payload } = handler(body)
    return new Response(payload === undefined ? null : JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return { fn, calls }
}
