import { useEffect, useState } from 'react'
import { HandCoins, PackageMinus, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatNaira, periodStart, type Period } from '../lib/format'

interface Summary {
  sales_total: number
  order_count: number
  profit: number | null // null for staff: profit is owner-only
  debtors_total: number
  debtors_count: number
  low_stock_count: number
  customer_count: number
}

interface Result {
  period: Period
  data?: Summary
  error?: string
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase
      .rpc('dashboard_summary', { p_from: periodStart(period).toISOString(), p_to: new Date().toISOString() })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          const missing = error.code === 'PGRST202' || error.code === '42883'
          setResult({
            period,
            error: missing
              ? 'The dashboard function is not in the database yet. Run the second migration file in the Supabase SQL editor.'
              : 'We could not load the numbers. Check your connection and try again.',
          })
        } else {
          setResult({ period, data: data as Summary })
        }
      })
    return () => {
      cancelled = true
    }
  }, [period])

  const loading = result?.period !== period
  const data = loading ? undefined : result?.data
  const error = loading ? undefined : result?.error

  const cards: { label: string; value: string; note: string; icon: LucideIcon }[] = data
    ? [
        {
          label: 'Total sales',
          value: formatNaira(data.sales_total),
          note: `${data.order_count} ${data.order_count === 1 ? 'sale' : 'sales'}`,
          icon: Wallet,
        },
        data.profit !== null
          ? { label: 'Profit', value: formatNaira(data.profit), note: 'After cost of goods', icon: TrendingUp }
          : { label: 'Customers', value: String(data.customer_count), note: 'On your list', icon: Users },
        {
          label: 'Debtors owe you',
          value: formatNaira(data.debtors_total),
          note: `${data.debtors_count} ${data.debtors_count === 1 ? 'customer' : 'customers'}`,
          icon: HandCoins,
        },
        {
          label: 'Low stock',
          value: String(data.low_stock_count),
          note: data.low_stock_count === 1 ? 'product to reorder' : 'products to reorder',
          icon: PackageMinus,
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Welcome back. Here is your business review.</p>
        <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                period === p.value ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-2xl border border-border bg-surface" />
            ))
          : cards.map(({ label, value, note, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-border bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-muted">{label}</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-highlight text-primary">
                    <Icon size={18} />
                  </span>
                </div>
                <div className="mt-3 font-display text-3xl font-bold">{value}</div>
                <div className="mt-1 text-xs text-muted">{note}</div>
              </div>
            ))}
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center text-sm text-muted">
        Charts, best customers and best sellers appear here once sales start coming in.
      </div>
    </div>
  )
}
