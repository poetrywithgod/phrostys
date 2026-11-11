import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, HandCoins, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { q, useLoad } from '../../lib/db'
import { formatDate, formatNaira } from '../../lib/format'
import { EmptyState, ErrorNote } from '../../components/ui'
import type { OpenSale } from '../../lib/types'
import PaymentModal from '../sales/PaymentModal'

interface Debtor {
  customer_id: string
  full_name: string
  phone: string | null
  total_owed: number
  oldest_debt_at: string
  open_sales: number
}
type OpenSaleRow = OpenSale & { customer_id: string }

const load = async () => {
  const [debtors, sales] = await Promise.all([
    q<Debtor[]>(supabase.from('v_debtors').select('customer_id,full_name,phone,total_owed,oldest_debt_at,open_sales').order('total_owed', { ascending: false })),
    q<OpenSaleRow[]>(
      supabase.from('sales').select('id,sale_number,customer_id,sold_at,total,amount_paid,balance').gt('balance', 0).order('sold_at'),
    ),
  ])
  return { debtors, sales }
}

const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000))

export default function DebtorsPage() {
  const { data, error, loading, reload } = useLoad(load)
  const [open, setOpen] = useState<string | null>(null)
  const [paying, setPaying] = useState<Debtor | null>(null)

  const salesOf = useMemo(() => {
    const m = new Map<string, OpenSaleRow[]>()
    for (const s of data?.sales ?? []) m.set(s.customer_id, [...(m.get(s.customer_id) ?? []), s])
    return m
  }, [data])
  const owedTotal = (data?.debtors ?? []).reduce((s, d) => s + Number(d.total_owed), 0)

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Customers who bought on credit and still owe you. Record a payment and the balance updates at once.</p>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.debtors.length ? (
        <EmptyState icon={<HandCoins size={24} />} title="Nobody owes you anything" text="When you record a credit sale, the customer shows up here until they have paid in full." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Total owed to you</div>
              <div className="mt-1 font-display text-xl font-bold text-warning sm:text-2xl">{formatNaira(owedTotal)}</div>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="text-xs font-semibold text-muted">Customers owing</div>
              <div className="mt-1 font-display text-xl font-bold sm:text-2xl">{data.debtors.length}</div>
            </div>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {data.debtors.map((d) => {
              const expanded = open === d.customer_id
              const days = daysSince(d.oldest_debt_at)
              return (
                <li key={d.customer_id}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <button
                      onClick={() => setOpen(expanded ? null : d.customer_id)}
                      aria-expanded={expanded}
                      aria-label={`Show sales owed by ${d.full_name}`}
                      className="rounded-lg p-1 text-muted hover:bg-highlight"
                    >
                      {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{d.full_name}</div>
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                        <span className={days > 30 ? 'font-semibold text-danger' : ''}>Owing for {days} day{days === 1 ? '' : 's'}</span>
                        <span>{d.open_sales} sale{d.open_sales === 1 ? '' : 's'}</span>
                        {d.phone && (
                          <a href={`tel:${d.phone}`} className="inline-flex items-center gap-1 hover:text-primary">
                            <Phone size={12} /> {d.phone}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-warning">{formatNaira(d.total_owed)}</div>
                      <button onClick={() => setPaying(d)} className="mt-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-on-primary hover:brightness-110">
                        Record payment
                      </button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="border-t border-border bg-bg/60 px-4 py-3 sm:pl-12">
                      <table className="w-full text-sm">
                        <tbody>
                          {(salesOf.get(d.customer_id) ?? []).map((s) => (
                            <tr key={s.id}>
                              <td className="py-1 font-semibold">Sale #{s.sale_number}</td>
                              <td className="py-1 text-muted">{formatDate(s.sold_at)}</td>
                              <td className="py-1 text-right text-muted">{formatNaira(s.amount_paid)} of {formatNaira(s.total)} paid</td>
                              <td className="py-1 pl-4 text-right font-semibold text-warning">{formatNaira(s.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {paying && (
        <PaymentModal
          who={paying.full_name}
          sales={salesOf.get(paying.customer_id) ?? []}
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
