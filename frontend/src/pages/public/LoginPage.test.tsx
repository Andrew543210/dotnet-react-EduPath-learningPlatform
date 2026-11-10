import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from './LoginPage'
import { fakeUser, mockFetch, renderRoutes } from '@/test/render'

const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/learn', element: <p>student home</p> },
  { path: '/admin', element: <p>admin home</p> },
  { path: '/courses/:id', element: <p>course page</p> },
]

afterEach(() => vi.unstubAllGlobals())

describe('LoginPage', () => {
  it('shows field errors without calling the API', async () => {
    const { fn } = mockFetch({})
    renderRoutes(routes, { path: '/login', language: 'en' })
    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Email must look like name@example.com')).toBeInTheDocument()
    expect(screen.getByText('Fill in this field')).toBeInTheDocument()
    expect(fn).not.toHaveBeenCalled()
  })

  it('signs in and opens the workspace for the user role', async () => {
    const { calls } = mockFetch({
      'POST /auth/login': () => ({
        body: { accessToken: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: fakeUser('Admin', { name: 'Олена Коваль' }) },
      }),
    })
    const { router } = renderRoutes(routes, { path: '/login', language: 'en' })
    await userEvent.type(screen.getByLabelText('Email'), 'admin@edupath.dev')
    await userEvent.type(screen.getByLabelText('Password'), 'Demo12345')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('admin home')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin')
    expect(calls[0].body).toEqual({ email: 'admin@edupath.dev', password: 'Demo12345' })
    expect(screen.getByText('Welcome, Олена!')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('edupath.session')!).user.role).toBe('Admin')
  })

  it('returns to the page from ?next after signing in', async () => {
    mockFetch({
      'POST /auth/login': () => ({
        body: { accessToken: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), user: fakeUser('Student') },
      }),
    })
    const { router } = renderRoutes(routes, { path: '/login?next=%2Fcourses%2F3', language: 'en' })
    await userEvent.type(screen.getByLabelText('Email'), 'student@edupath.dev')
    await userEvent.type(screen.getByLabelText('Password'), 'Demo12345')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/courses/3'))
  })

  it('shows the server message for wrong credentials', async () => {
    mockFetch({ 'POST /auth/login': () => ({ status: 401, body: { detail: 'Невірний email або пароль' } }) })
    renderRoutes(routes, { path: '/login' })
    await userEvent.type(screen.getByLabelText('Email'), 'student@edupath.dev')
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong-password1')
    await userEvent.click(screen.getByRole('button', { name: 'Увійти' }))
    expect(await screen.findByText('Невірний email або пароль')).toBeInTheDocument()
    expect(localStorage.getItem('edupath.session')).toBeNull()
  })
})
