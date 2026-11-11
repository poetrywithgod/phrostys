import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, Receipt, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { one, q, useLoad } from '../../lib/db'
import { formatDateTime, formatNaira, formatQty, periodStart, type Period } from '../../lib/format'
import { EmptyState, ErrorNote, fieldClass, primaryBtn } from '../../components/ui'
import type { OpenSale, PaymentType, Product } from '../../lib/types'
import { loadPeople } from '../stock/data'
import PaymentModal from './PaymentModal'

interface SaleRow {
  id: string
  sale_number: number
  sold_at: string
  channel: 'shop' | 'website' | 'phone_chat'
  payment_type: PaymentType
  total: number
  amount_paid: number
  balance: number
  note: string | null
  created_by: string | null
  customers: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null
  sale_items: { product_id: string; quantity: number; unit_price: number; line_total: number }[]
  sale_payments: { amount: number; method: string; paid_at: string; note: string | null }[]
}

const load = async () => {
  const [sales, products, people] = await Promise.all([
    q<SaleRow[]>(
      supabase
        .from('sales')
        .select(
          'id,sale_number,sold_at,channel,payment_type,total,amount_paid,balance,note,created_by,customers(full_name,phone),sale_items(product_id,quantity,unit_price,line_total),sale_payments(amount,method,paid_at,note)',
        )
        .order('sold_at', { ascending: false })
        .limit(400),
    ),
    q<Pick<Product, 'id' | 'name' | 'unit'>[]>(supabase.from('products').select('id,name,unit')),
    loadPeople(),
  ])
  return { sales, products, people }
}

const PERIODS: { id: Period | 'all'; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
  { id: 'all', label: 'All' },
]
const TYPE_LABEL: Record<PaymentType, string> = { cash: 'Cash', transfer: 'Transfer', credit: 'Credit' }
const CHANNEL_LABEL = { shop: 'Shop', website: 'Website', phone_chat: 'Phone / chat' } as const

const customerOf = (s: SaleRow) => one(s.customers)

export default function SalesPage() {
  const { data, error, loading, reload } = useLoad(load)
  const location = useLocation()
  const [period, setPeriod] = useState<Period | 'all'>('today')
  const [type, setType] = useState<'' | PaymentType>('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [paying, setPaying] = useState<SaleRow | null>(null)
  const [justSaved, setJustSaved] = useState(Boolean((location.state as { saved?: boolean } | null)?.saved))

  const product = useMemo(() => new Map(data?.products.map((p) => [p.id, p])), [data])
  const rows = useMemo(() => {
    const since = period === 'all' ? null : periodStart(period).toISOString()
    const term = search.trim().toLowerCase()
    return (data?.sales ?? []).filter(
      (s) =>
        (!since || s.sold_at >= since) &&
        (!type || s.payment_type === type) &&
        (!term || String(s.sale_number) === term || (customerOf(s)?.full_name ?? 'walk-in').toLowerCase().includes(term)),
    )
  }, [data, period, type, search])

  const sum = rows.reduce((t, s) => t + Number(s.total), 0)
  const owing = rows.reduce((t, s) => t + Number(s.balance), 0)

  const newButton = (
    <Link to="/sales/new" className={primaryBtn}>
      <Plus size={18} /> New sale
    </Link>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Every sale, shop or phone. Credit sales go onto the debtors list automatically.</p>
        {newButton}
      </div>

      {justSaved && (
        <p role="status" className="flex items-center justify-between rounded-xl bg-highlight px-4 py-2.5 text-sm font-semibold text-primary">
          Sale recorded. Stock has been updated.
          <button onClick={() => setJustSaved(false)} className="text-xs font-semibold underline">Dismiss</button>
        </p>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.sales.length ? (
        <EmptyState icon={<Receipt size={24} />} title="No sales yet" text="Record your first sale and it will appear here, with stock and debtors updating by themselves." action={newButton} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${period === p.id ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <select className={`${fieldClass} w-40`} aria-label="Filter by payment type" value={type} onChange={(e) => setType(e.target.value as '' | PaymentType)}>
              <option value="">All payments</option>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="credit">Credit</option>
            </select>
            <div className="relative min-w-48 flex-1 sm:max-w-xs">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className={`${fieldClass} pl-9`} placeholder="Customer or sale number" aria-label="Search sales" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sales', value: String(rows.length) },
              { label: 'Total', value: formatNaira(sum) },
              { label: 'Still owed', value: formatNaira(owing) },
            ].map((t) => (
              <div key={t.label} className="rounded-2xl border border-border bg-surface p-4">
                <div className="text-xs font-semibold text-muted">{t.label}</div>
                <div className="mt-1 font-display text-lg font-bold sm:text-2xl">{t.value}</div>
              </div>
            ))}
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {rows.map((s) => {
              const expanded = open === s.id
              const who = customerOf(s)?.full_name ?? 'Walk-in customer'
              return (
                <li key={s.id}>
                  <button onClick={() => setOpen(expanded ? null : s.id)} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-highlight/40">
                    {expanded ? <ChevronDown size={18} className="shrink-0 text-muted" /> : <ChevronRight size={18} className="shrink-0 text-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{who}</div>
                      <div className="text-xs text-muted">
                        #{s.sale_number} · {formatDateTime(s.sold_at)}
                        {s.channel !== 'shop' && ` · ${CHANNEL_LABEL[s.channel]}`}
                      </div>
                    </div>
                    <span
                      className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:inline ${s.balance > 0 ? 'bg-warning/15 text-warning' : 'bg-highlight text-primary'}`}
                    >
                      {s.balance > 0 ? `Owes ${formatNaira(s.balance)}` : TYPE_LABEL[s.payment_type]}
                    </span>
                    <div className="shrink-0 text-sm font-bold">{formatNaira(s.total)}</div>
                  </button>
                  {expanded && (
                    <div className="space-y-3 border-t border-border bg-bg/60 px-4 py-3 sm:pl-11">
                      <table className="w-full text-sm">
                        <tbody>
                          {s.sale_items.map((i, idx) => {
                            const p = product.get(i.product_id)
                            return (
                              <tr key={idx}>
                                <td className="py-1 font-semibold">{p?.name ?? 'Product'}</td>
                                <td className="py-1 text-right text-muted">{formatQty(i.quantity)} {p?.unit} × {formatNaira(i.unit_price)}</td>
                                <td className="py-1 pl-4 text-right font-semibold">{formatNaira(i.line_total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {s.sale_payments.length > 0 && (
                        <div className="text-xs text-muted">
                          {s.sale_payments.map((p, idx) => (
                            <div key={idx}>
                              Paid {formatNaira(p.amount)} by {p.method} · {formatDateTime(p.paid_at)}
                            </div>
                          ))}
                        </div>
                      )}
                      {s.note && <p className="text-xs text-muted">Note: {s.note}</p>}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs text-muted">Recorded by {(s.created_by && data.people.get(s.created_by)) || 'a team member'}</span>
                        {s.balance > 0 && (
                          <button onClick={() => setPaying(s)} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary hover:brightness-110">
                            Record payment
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
            {!rows.length && <li className="px-4 py-10 text-center text-sm text-muted">No sales match.</li>}
          </ul>
        </>
      )}

      {paying && (
        <PaymentModal
          who={customerOf(paying)?.full_name ?? 'Customer'}
          sales={[paying satisfies OpenSale]}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
