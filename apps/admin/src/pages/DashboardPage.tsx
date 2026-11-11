import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HandCoins, PackageMinus, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDateTime, formatNaira, formatQty, periodEnd, periodStart, type Period } from '../lib/format'
import SalesChart, { type SeriesPoint } from '../components/SalesChart'

interface Summary {
  sales_total: number
  order_count: number
  profit: number | null // null for staff: profit is owner-only
  debtors_total: number
  debtors_count: number
  low_stock_count: number
  customer_count: number
}

interface Charts {
  unit: 'hour' | 'day'
  series: SeriesPoint[]
  top_products: { product_id: string; name: string; unit: string; quantity: number; revenue: number }[]
  top_customers: { customer_id: string; full_name: string; orders: number; spent: number }[]
  recent_sales: { id: string; sale_number: number; sold_at: string; total: number; balance: number; payment_type: string; customer: string }[]
}

interface Result {
  period: Period
  data?: Summary
  charts?: Charts
  error?: string
  chartsError?: string
}

const REFRESH_MS = 30_000

/** A flat, zero-filled series so the chart still draws an axis if the charts function is not installed yet. */
function flatSeries(period: Period): Charts {
  const start = periodStart(period)
  const hourly = period === 'today'
  const count = hourly ? 24 : Math.round((periodEnd(period).getTime() - start.getTime()) / 86_400_000)
  const pad = (v: number) => String(v).padStart(2, '0')
  const series = Array.from({ length: count }, (_, i) => {
    const d = new Date(start)
    if (hourly) d.setHours(i)
    else d.setDate(d.getDate() + i)
    return { at: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`, revenue: 0, orders: 0, profit: null }
  })
  return { unit: hourly ? 'hour' : 'day', series, top_products: [], top_customers: [], recent_sales: [] }
}

const PERIODS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('today')
  const [result, setResult] = useState<Result | null>(null)

  const [tick, setTick] = useState(0)

  // Keep the numbers live: refresh every 30 seconds, and straight away when you come back to this tab.
  useEffect(() => {
    const refresh = () => document.visibilityState === 'visible' && setTick((t) => t + 1)
    const timer = setInterval(refresh, REFRESH_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const from = periodStart(period).toISOString()
    Promise.all([
      supabase.rpc('dashboard_summary', { p_from: from, p_to: new Date().toISOString() }),
      supabase.rpc('dashboard_charts', { p_from: from, p_to: periodEnd(period).toISOString() }),
    ]).then(([summary, charts]) => {
      if (cancelled) return
      const missing = (c?: string) => c === 'PGRST202' || c === '42883'
      setResult({
        period,
        data: summary.error ? undefined : (summary.data as Summary),
        charts: charts.error ? undefined : (charts.data as Charts),
        error: summary.error
          ? missing(summary.error.code)
            ? 'The dashboard function is not in the database yet. Run the second migration file in the Supabase SQL editor.'
            : 'We could not load the numbers. Check your connection and try again.'
          : undefined,
        chartsError: charts.error
          ? missing(charts.error.code)
            ? 'The charts function is not in the database yet. Run the 20261110000400_dashboard_charts.sql file in the Supabase SQL editor.'
            : 'We could not load the charts. Check your connection and try again.'
          : undefined,
      })
    })
    return () => {
      cancelled = true
    }
  }, [period, tick])

  const loading = result?.period !== period
  const data = loading ? undefined : result?.data
  const error = loading ? undefined : (result?.error ?? result?.chartsError)
  const charts = loading ? undefined : (result?.charts ?? flatSeries(period))
  const maxProduct = Math.max(1, ...(charts?.top_products.map((p) => Number(p.revenue)) ?? []))
  const maxCustomer = Math.max(1, ...(charts?.top_customers.map((c) => Number(c.spent)) ?? []))

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

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Sales over time</h2>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" /> Live
          </span>
        </div>
        {charts ? <SalesChart points={charts.series} unit={charts.unit} /> : <div className="h-64 animate-pulse rounded-xl bg-highlight/40" />}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Top products</h2>
          <p className="text-xs text-muted">By money earned in this period</p>
          {!charts?.top_products.length ? (
            <ul className="mt-4 space-y-3" aria-label="No products sold yet">
              {[80, 55, 35].map((w) => (
                <li key={w} className="h-8 rounded-lg bg-highlight/40" style={{ width: `${w}%` }} />
              ))}
              <li className="pt-1 text-sm text-muted">No sales yet. Your best sellers will rank here.</li>
            </ul>
          ) : (
            <ul className="mt-4 space-y-3">
              {charts.top_products.map((p, i) => (
                <li key={p.product_id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{i + 1}. {p.name}</span>
                    <span className="shrink-0 font-bold">{formatNaira(p.revenue)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-highlight">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(Number(p.revenue) / maxProduct) * 100}%` }} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{formatQty(p.quantity)} {p.unit} sold</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Best customers</h2>
          <p className="text-xs text-muted">Who spent the most in this period</p>
          {!charts?.top_customers.length ? (
            <ul className="mt-4 space-y-3" aria-label="No customer purchases yet">
              {[80, 55, 35].map((w) => (
                <li key={w} className="h-8 rounded-lg bg-highlight/40" style={{ width: `${w}%` }} />
              ))}
              <li className="pt-1 text-sm text-muted">No customer purchases yet. Sales to named customers rank here.</li>
            </ul>
          ) : (
            <ul className="mt-4 space-y-3">
              {charts.top_customers.map((c, i) => (
                <li key={c.customer_id}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{i + 1}. {c.full_name}</span>
                    <span className="shrink-0 font-bold">{formatNaira(c.spent)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-highlight">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(Number(c.spent) / maxCustomer) * 100}%` }} />
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{c.orders} {Number(c.orders) === 1 ? 'order' : 'orders'}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Recent sales</h2>
          <Link to="/sales" className="text-sm font-semibold text-primary hover:underline">See all</Link>
        </div>
        {!charts?.recent_sales.length ? (
          <p className="mt-3 text-sm text-muted">Nothing sold yet. <Link to="/sales/new" className="font-semibold text-primary hover:underline">Record your first sale</Link>.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {charts.recent_sales.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-semibold">Sale #{s.sale_number} · {s.customer}</div>
                  <div className="text-xs text-muted">{formatDateTime(s.sold_at)}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-bold">{formatNaira(s.total)}</div>
                  {Number(s.balance) > 0 && <div className="text-xs font-semibold text-warning">Owes {formatNaira(s.balance)}</div>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
