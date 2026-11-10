import { screen } from '@testing-library/react'
import { RequireRole, GuestOnly } from './guards'
import { renderRoutes, signIn } from '@/test/render'

const routes = [
  { path: '/login', element: <p>login page</p> },
  { path: '/learn', element: <p>student home</p> },
  { path: '/teach', element: <p>teacher home</p> },
  {
    element: <RequireRole roles={['Admin']} />,
    children: [{ path: '/admin', element: <p>admin area</p> }],
  },
  {
    element: <RequireRole roles={['Teacher', 'Admin']} />,
    children: [{ path: '/teach/courses', element: <p>teacher courses</p> }],
  },
  { element: <GuestOnly />, children: [{ path: '/register', element: <p>register form</p> }] },
]

describe('RequireRole', () => {
  it('sends a guest to the login page and remembers where they were going', () => {
    const { router } = renderRoutes(routes, { path: '/admin?tab=users' })
    expect(screen.getByText('login page')).toBeInTheDocument()
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/admin?tab=users')}`)
  })

  it('shows 403 to a student opening the admin area', () => {
    signIn('Student')
    renderRoutes(routes, { path: '/admin', language: 'en' })
    expect(screen.getByRole('heading', { name: 'No access' })).toBeInTheDocument()
    expect(screen.queryByText('admin area')).not.toBeInTheDocument()
  })

  it('lets the admin into the admin area and the teacher workspace', () => {
    signIn('Admin')
    const { router } = renderRoutes(routes, { path: '/admin' })
    expect(screen.getByText('admin area')).toBeInTheDocument()
    router.navigate('/teach/courses')
    return screen.findByText('teacher courses')
  })

  it('lets a teacher into the teacher workspace', () => {
    signIn('Teacher')
    renderRoutes(routes, { path: '/teach/courses' })
    expect(screen.getByText('teacher courses')).toBeInTheDocument()
  })
})

describe('GuestOnly', () => {
  it('redirects a signed-in teacher to their workspace', () => {
    signIn('Teacher')
    renderRoutes(routes, { path: '/register' })
    expect(screen.getByText('teacher home')).toBeInTheDocument()
  })

  it('shows the form to a guest', () => {
    renderRoutes(routes, { path: '/register' })
    expect(screen.getByText('register form')).toBeInTheDocument()
  })
})
