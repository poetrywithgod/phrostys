import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { AppRole } from './AuthContext'
import { useAuth } from './useAuth'
import NoAccessPage from '../pages/NoAccessPage'

/** Everything inside needs a signed-in owner or staff member. */
export function RequireAccess() {
  const { session, hasAccess } = useAuth()
  const location = useLocation()
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (!hasAccess) return <NoAccessPage />
  return <Outlet />
}

/** Sends anyone without one of the given roles back to the dashboard. */
export function RequireRole({ roles }: { roles: AppRole[] }) {
  const { profile } = useAuth()
  if (!profile || !roles.includes(profile.role)) return <Navigate to="/" replace />
  return <Outlet />
}
