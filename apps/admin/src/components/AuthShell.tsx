import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import Logo from './Logo'
import { useTheme } from '../lib/theme'

/**
 * The frame shared by every signed-out screen: a soft drifting colour field,
 * the logo, and a frosted-glass card holding the content.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()

  return (
    <div className="relative isolate grid min-h-screen place-items-center px-4 py-10 text-text">
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-blob a" />
        <span className="auth-blob b" />
        <span className="auth-blob c" />
      </div>

      <button
        onClick={toggle}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute right-4 top-4 rounded-full border border-glass-border bg-glass-bg p-2.5 text-muted backdrop-blur-xl transition-colors hover:text-text"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="w-full max-w-md">
        <Logo className="mx-auto mb-7 h-16 w-auto text-primary sm:h-20" />
        <div className="rounded-3xl border border-glass-border bg-glass-bg p-7 shadow-[var(--glass-shadow)] backdrop-blur-2xl backdrop-saturate-150 sm:p-9">
          {children}
        </div>
      </div>
    </div>
  )
}
