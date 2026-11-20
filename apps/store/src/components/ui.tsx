import type { ReactNode } from 'react'
import { Minus, Plus, Star } from 'lucide-react'

export const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-on-primary shadow-sm transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50'

export const ghostBtn =
  'inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-text transition hover:bg-highlight active:scale-[0.98] disabled:opacity-50'

export const fieldClass =
  'w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30'

/** Star rating. `value` can be fractional; it is shown rounded to the nearest half. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)))
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} className="absolute inset-0 text-border" fill="currentColor" strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star size={size} className="text-accent" fill="currentColor" strokeWidth={0} />
            </span>
          </span>
        )
      })}
    </span>
  )
}

/** A − 1 + stepper that never goes below 1 or above `max`. */
export function QtyStepper({
  value,
  max,
  onChange,
  size = 'md',
}: {
  value: number
  max: number
  onChange: (next: number) => void
  size?: 'sm' | 'md'
}) {
  const btn =
    (size === 'sm' ? 'h-8 w-8' : 'h-10 w-10') +
    ' grid place-items-center rounded-full text-text transition hover:bg-highlight disabled:opacity-40 disabled:hover:bg-transparent'
  return (
    <div className="inline-flex items-center rounded-full border border-border bg-surface">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Fewer">
        <Minus size={16} />
      </button>
      <span className={(size === 'sm' ? 'w-8' : 'w-10') + ' text-center text-sm font-semibold tabular-nums'} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="More">
        <Plus size={16} />
      </button>
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-highlight/70 ${className}`} aria-hidden="true" />
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
      {children}
    </p>
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {children && <p className="mt-2 text-sm text-muted">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/** A labelled form field with an error line. Pass the id used by the input inside. */
export function Field({
  id,
  label,
  required,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label} {required && <span className="text-danger" aria-hidden="true">*</span>}
      </label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}
