import { useCallback, useMemo, useState } from 'react'
import { Boxes, Download, Percent, ReceiptText, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { q, useLoad } from '../../lib/db'
import { formatNaira, formatQty } from '../../lib/format'
import { ErrorNote } from '../../components/ui'

interface ProductRow {
  product_id: string
  name: string
  unit: string
  category: string | null
  quantity: number
  revenue: number
  cost: number
  profit: number
  best_buyer: string | null
  best_buyer_quantity: number | null
}
interface Report {
  totals: { revenue: number; cost: number; profit: number; units: number; orders: number }
  products: ProductRow[]
  categories: { name: string; revenue: number; profit: number }[]
  channels: { channel: string; revenue: number; profit: number }[]
  customers: { customer_id: string; full_name: string; orders: number; spent: number; profit: number }[]
  not_selling: { product_id: string; name: string; unit: string; quantity: number; stock_value: number }[]
  stock_value: number
}

type Range = 'month' | 'last-month' | 'year' | 'all'
const RANGES: { id: Range; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'last-month', label: 'Last month' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
]
function bounds(r: Range): [Date, Date] {
  const n = new Date()
  const far = new Date(n.getFullYear() + 1, 0, 1)
  if (r === 'month') return [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 1)]
  if (r === 'last-month') return [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 1)]
  if (r === 'year') return [new Date(n.getFullYear(), 0, 1), far]
  return [new Date(2000, 0, 1), far]
}

const CHANNEL: Record<string, string> = { shop: 'In the shop', website: 'Website', phone_chat: 'Phone and chat' }
const pct = (profit: number, revenue: number) => (Number(revenue) > 0 ? `${Math.round((Number(profit) / Number(revenue)) * 100)}%` : '–')

function Kpi({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string; note: string }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between text-sm text-muted">
        {label}
        <span className="grid h-9 w-9 place-items-center rounded-full bg-highlight text-primary"><Icon size={18} /></span>
      </div>
      <div className="mt-2 font-display text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-muted">{note}</div>
    </div>
  )
}

function Bars({ rows, tone }: { rows: { key: string; label: string; value: number; note?: string }[]; tone: 'primary' | 'accent' }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="mt-4 space-y-3">
      {rows.map((r) => (
        <li key={r.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{r.label}</span>
            <span className="shrink-0 font-bold">{formatNaira(r.value)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-highlight">
            <div className={`h-full rounded-full ${tone === 'primary' ? 'bg-primary' : 'bg-accent'}`} style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
          {r.note && <div className="mt-0.5 text-xs text-muted">{r.note}</div>}
        </li>
      ))}
    </ul>
  )
}

const Empty = ({ text }: { text: string }) => (
  <div className="mt-4 space-y-3" aria-label={text}>
    {[80, 55, 35].map((w) => <div key={w} className="h-8 rounded-lg bg-highlight/40" style={{ width: `${w}%` }} />)}
    <p className="pt-1 text-sm text-muted">{text}</p>
  </div>
)

type SortKey = 'revenue' | 'profit' | 'quantity'

function csv(rows: ProductRow[]): string {
  const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Product', 'Category', 'Sold', 'Unit', 'Revenue', 'Cost', 'Profit', 'Best buyer']
  return [head, ...rows.map((r) => [r.name, r.category, r.quantity, r.unit, r.revenue, r.cost, r.profit, r.best_buyer])].map((l) => l.map(esc).join(',')).join('\n')
}

export default function ReportsPage() {
  const [range, setRange] = useState<Range>('month')
  const [sort, setSort] = useState<SortKey>('revenue')

  const load = useCallback(async () => {
    const [from, to] = bounds(range)
    try {
      return await q<Report>(supabase.rpc('reports_overview', { p_from: from.toISOString(), p_to: to.toISOString() }))
    } catch (err) {
      // null means "the SQL file has not been run yet"; anything else is a real failure.
      if (['PGRST202', '42883'].includes((err as { code?: string }).code ?? '')) return null
      throw err
    }
  }, [range])
  const { data, error, loading } = useLoad(load)

  const products = useMemo(() => [...(data?.products ?? [])].sort((a, b) => Number(b[sort]) - Number(a[sort])), [data, sort])
  const t = data?.totals

  function download() {
    const blob = new Blob([csv(products)], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `phrostys-product-report-${range}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const missing = data === null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Where the money comes from and where it goes. Only you can see this page.</p>
        <div role="tablist" aria-label="Period" className="flex gap-1 rounded-full border border-border bg-surface p-1">
          {RANGES.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${range === r.id ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {missing && <ErrorNote>The reports function is not in the database yet. Run the 20261110000500_reports.sql file in the Supabase SQL editor.</ErrorNote>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi icon={Wallet} label="Sales" value={formatNaira(t?.revenue ?? 0)} note={`${t?.orders ?? 0} orders`} />
        <Kpi icon={ReceiptText} label="Cost of goods" value={formatNaira(t?.cost ?? 0)} note="What the items cost you" />
        <Kpi icon={TrendingUp} label="Profit" value={formatNaira(t?.profit ?? 0)} note="Sales minus cost of goods" />
        <Kpi icon={Percent} label="Profit margin" value={pct(t?.profit ?? 0, t?.revenue ?? 0)} note="Profit out of every ₦100 sold" />
        <Kpi icon={Boxes} label="Stock on shelf" value={formatNaira(data?.stock_value ?? 0)} note="At what you paid for it" />
      </div>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">Products</h2>
            <p className="text-xs text-muted">What sold, what it earned and who buys the most of it</p>
          </div>
          <div className="flex items-center gap-2">
            <div role="tablist" aria-label="Sort products" className="flex gap-1 rounded-full border border-border p-1">
              {([['revenue', 'Sales'], ['profit', 'Profit'], ['quantity', 'Units']] as const).map(([id, label]) => (
                <button key={id} role="tab" aria-selected={sort === id} onClick={() => setSort(id)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${sort === id ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}>
                  {label}
                </button>
              ))}
            </div>
            <button onClick={download} disabled={!products.length} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-highlight disabled:opacity-40">
              <Download size={14} /> CSV
            </button>
          </div>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Loading…</p>
        ) : !products.length ? (
          <Empty text="No sales in this period yet. Your product report fills in as you sell." />
        ) : (
          <>
          <ul className="mt-4 divide-y divide-border sm:hidden">
            {products.map((p) => (
              <li key={p.product_id} className="py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{p.name}</span>
                  <span className="shrink-0 font-bold">{formatNaira(p.revenue)}</span>
                </div>
                <div className="text-xs text-muted">{p.category ?? 'No category'} · {formatQty(p.quantity)} {p.unit} sold</div>
                <div className="mt-1 flex justify-between text-xs">
                  <span className={Number(p.profit) < 0 ? 'font-semibold text-danger' : 'font-semibold'}>Profit {formatNaira(p.profit)} ({pct(p.profit, p.revenue)})</span>
                  <span className="text-muted">{p.best_buyer ? `Best buyer: ${p.best_buyer}` : ''}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted">
                  <th className="pb-2 font-semibold">Product</th>
                  <th className="pb-2 text-right font-semibold">Sold</th>
                  <th className="pb-2 text-right font-semibold">Sales</th>
                  <th className="pb-2 text-right font-semibold">Profit</th>
                  <th className="pb-2 text-right font-semibold">Margin</th>
                  <th className="pb-2 pl-4 font-semibold">Best buyer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.product_id}>
                    <td className="py-2.5 pr-3"><div className="font-semibold">{p.name}</div><div className="text-xs text-muted">{p.category ?? 'No category'}</div></td>
                    <td className="py-2.5 text-right">{formatQty(p.quantity)} {p.unit}</td>
                    <td className="py-2.5 text-right font-semibold">{formatNaira(p.revenue)}</td>
                    <td className={`py-2.5 text-right font-semibold ${Number(p.profit) < 0 ? 'text-danger' : ''}`}>{formatNaira(p.profit)}</td>
                    <td className="py-2.5 text-right">{pct(p.profit, p.revenue)}</td>
                    <td className="py-2.5 pl-4">{p.best_buyer ? <>{p.best_buyer}<span className="text-xs text-muted"> · {formatQty(p.best_buyer_quantity ?? 0)} {p.unit}</span></> : <span className="text-muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Best customers</h2>
          <p className="text-xs text-muted">Top 10 by spend, with the profit you made from them</p>
          {!data?.customers.length ? <Empty text="No sales to named customers in this period." /> : (
            <Bars tone="accent" rows={data.customers.map((c) => ({ key: c.customer_id, label: c.full_name, value: Number(c.spent), note: `${c.orders} ${Number(c.orders) === 1 ? 'order' : 'orders'} · ${formatNaira(c.profit)} profit` }))} />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Profit by category</h2>
          <p className="text-xs text-muted">Which kinds of product earn the most</p>
          {!data?.categories.length ? <Empty text="Categories appear once you make sales." /> : (
            <Bars tone="primary" rows={data.categories.map((c) => ({ key: c.name, label: c.name, value: Number(c.profit), note: `${formatNaira(c.revenue)} sold · ${pct(c.profit, c.revenue)} margin` }))} />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Where sales come from</h2>
          <p className="text-xs text-muted">Shop, website, and phone or chat orders</p>
          {!data?.channels.length ? <Empty text="No sales in this period yet." /> : (
            <Bars tone="primary" rows={data.channels.map((c) => ({ key: c.channel, label: CHANNEL[c.channel] ?? c.channel, value: Number(c.revenue), note: `${formatNaira(c.profit)} profit` }))} />
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="font-display text-lg font-bold">On the shelf, not selling</h2>
          <p className="text-xs text-muted">In stock but nothing sold in this period. This is money sitting still.</p>
          {!data?.not_selling.length ? (
            <p className="mt-4 text-sm text-muted">Nothing here. Everything in stock has sold in this period.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {data.not_selling.map((s) => (
                <li key={s.product_id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0"><div className="truncate font-semibold">{s.name}</div><div className="text-xs text-muted">{formatQty(s.quantity)} {s.unit} in stock</div></div>
                  <div className="shrink-0 font-bold">{formatNaira(s.stock_value)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
