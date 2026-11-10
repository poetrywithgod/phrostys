import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react'
import Logo from '../components/Logo'
import { useAuth } from '../auth/useAuth'
import { useTheme } from '../lib/theme'
import { NAV } from './nav'

export default function AppLayout() {
  const { profile, signOut } = useAuth()
  const { theme, toggle } = useTheme()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(false) // desktop: icons only
  const [drawerOpen, setDrawerOpen] = useState(false) // phone: slide-in menu

  const role = profile?.role ?? 'staff'
  const items = NAV.filter((item) => item.roles.includes(role))
  const current = items.find((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))
  const labelClass = collapsed ? 'lg:hidden' : ''

  return (
    <div className="min-h-screen bg-bg text-text lg:flex">
      {drawerOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-sidebar text-sidebar-text transition-transform duration-200',
          'lg:sticky lg:top-0 lg:h-screen lg:shrink-0 lg:translate-x-0 lg:transition-[width]',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'lg:w-20' : 'lg:w-64',
        ].join(' ')}
      >
        <div className="flex h-16 items-center justify-between px-5">
          {collapsed ? (
            <span className="hidden font-display text-3xl font-bold text-sidebar-logo lg:block">P</span>
          ) : null}
          <Logo className={`h-11 w-auto text-sidebar-logo ${collapsed ? 'lg:hidden' : ''}`} />
          <button
            aria-label="Close menu"
            className="rounded-lg p-1 hover:bg-sidebar-hover lg:hidden"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              title={label}
              onClick={() => setDrawerOpen(false)}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                  collapsed ? 'lg:justify-center' : '',
                  isActive
                    ? 'bg-sidebar-active text-sidebar-active-text'
                    : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text',
                ].join(' ')
              }
            >
              <Icon size={20} className="shrink-0" />
              <span className={labelClass}>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="space-y-1 border-t border-sidebar-hover p-3">
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={`hidden w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text lg:flex ${collapsed ? 'justify-center' : ''}`}
          >
            {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            <span className={labelClass}>Collapse</span>
          </button>
          <button
            onClick={signOut}
            title="Sign out"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-text ${collapsed ? 'lg:justify-center' : ''}`}
          >
            <LogOut size={20} className="shrink-0" />
            <span className={labelClass}>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button
            aria-label="Open menu"
            className="rounded-lg p-2 hover:bg-highlight lg:hidden"
            onClick={() => setDrawerOpen(true)}
          >
            <Menu size={22} />
          </button>
          <h1 className="font-display text-xl font-bold sm:text-2xl">{current?.label ?? 'Phrostys'}</h1>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggle}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-full p-2 text-muted hover:bg-highlight hover:text-text"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="hidden text-right leading-tight sm:block">
              <div className="text-sm font-semibold">{profile?.full_name || 'Signed in'}</div>
              <div className="text-xs capitalize text-muted">{role}</div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
