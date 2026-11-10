import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/useAuth'
import { RequireAccess, RequireRole } from './auth/guards'
import Loader from './components/Loader'
import AppLayout from './layout/AppLayout'
import { NAV } from './layout/nav'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import PlaceholderPage from './pages/PlaceholderPage'

const ownerOnly = NAV.filter((n) => n.roles.length === 1)
const everyone = NAV.filter((n) => n.roles.length > 1 && n.to !== '/')

export default function App() {
  const { loading } = useAuth()

  return (
    <>
      <Loader ready={!loading} />
      {!loading && (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAccess />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              {everyone.map((n) => (
                <Route key={n.to} path={n.to} element={<PlaceholderPage title={n.label} description={n.description} />} />
              ))}
              <Route element={<RequireRole roles={['owner']} />}>
                {ownerOnly.map((n) => (
                  <Route key={n.to} path={n.to} element={<PlaceholderPage title={n.label} description={n.description} />} />
                ))}
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
      )}
    </>
  )
}
