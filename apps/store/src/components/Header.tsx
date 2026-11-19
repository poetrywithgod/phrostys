import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Moon, Search, ShoppingBag, Sun } from 'lucide-react'
import { useCart } from '../lib/cart'
import { useTheme } from '../lib/theme'
import Logo from './Logo'

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-2 text-sm font-semibold transition hover:bg-highlight ${isActive ? 'bg-highlight' : ''}`

export default function Header() {
  const { count } = useCart()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const search = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/shop?q=${encodeURIComponent(q.trim())}` : '/shop')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" aria-label="Phrostys home" className="shrink-0 text-primary">
          <Logo className="h-9 w-auto sm:h-10" />
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Main">
          <NavLink to="/" end className={navClass}>Home</NavLink>
          <NavLink to="/shop" className={navClass}>Shop</NavLink>
        </nav>

        <form onSubmit={search} role="search" className="relative ml-auto hidden max-w-xs flex-1 sm:block">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="w-full rounded-full border border-border bg-surface py-2.5 pl-10 pr-4 text-sm outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
          />
        </form>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <Link to="/shop" className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-highlight sm:hidden" aria-label="Search products">
            <Search size={20} />
          </Link>
          <button
            type="button"
            onClick={toggle}
            className="grid h-10 w-10 place-items-center rounded-full transition hover:bg-highlight"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <Link to="/cart" className="relative grid h-10 w-10 place-items-center rounded-full transition hover:bg-highlight" aria-label={`Cart, ${count} items`}>
            <ShoppingBag size={20} />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold leading-5 text-[#011207]">
                {count}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
