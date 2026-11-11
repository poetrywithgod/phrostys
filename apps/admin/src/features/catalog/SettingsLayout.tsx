import { NavLink, Outlet } from 'react-router-dom'

const TABS = [
  { to: '/settings/products', label: 'Products' },
  { to: '/settings/categories', label: 'Categories' },
  { to: '/settings/suppliers', label: 'Suppliers' },
  { to: '/settings/staff', label: 'Staff' },
]

export default function SettingsLayout() {
  return (
    <div className="space-y-5">
      <nav className="flex gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1 sm:w-fit">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                isActive ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  )
}
