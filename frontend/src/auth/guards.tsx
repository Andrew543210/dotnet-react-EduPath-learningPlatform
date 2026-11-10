import { Navigate, Outlet, useLocation } from 'react-router'
import type { UserRole } from '@/api/types'
import { ForbiddenPage } from '@/pages/public/ErrorPages'
import { homeFor, useAuth } from './AuthProvider'

export function RequireRole({ roles }: { roles?: UserRole[] }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (roles && !roles.includes(user.role)) return <ForbiddenPage />
  return <Outlet />
}

export function GuestOnly() {
  const { user } = useAuth()
  if (user) return <Navigate to={homeFor(user.role)} replace />
  return <Outlet />
}
