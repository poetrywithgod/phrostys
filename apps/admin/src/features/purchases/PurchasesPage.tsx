import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, Search, Truck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { q, useLoad } from '../../lib/db'
import { formatDate, formatNaira, formatQty } from '../../lib/format'
import { EmptyState, ErrorNote, fieldClass, primaryBtn } from '../../components/ui'
import type { Product, Supplier } from '../../lib/types'
import { loadLocation, loadPeople } from '../stock/data'
import PurchaseForm from './PurchaseForm'

interface PurchaseItem {
  product_id: string
  quantity: number
  unit_cost: number
  line_total: number
}
interface PurchaseRow {
  id: string
  purchase_date: string
  reference: string | null
  note: string | null
  created_by: string | null
  suppliers: { name: string } | { name: string }[] | null
  purchase_items: PurchaseItem[]
}
type ProductLite = Pick<Product, 'id' | 'name' | 'unit' | 'pack_size' | 'supplier_id'>

const load = async () => {
  const [purchases, products, suppliers, people, location] = await Promise.all([
    q<PurchaseRow[]>(
      supabase
        .from('purchases')
        .select('id,purchase_date,reference,note,created_by,suppliers(name),purchase_items(product_id,quantity,unit_cost,line_total)')
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(300),
    ),
    q<(ProductLite & { is_active: boolean })[]>(supabase.from('products').select('id,name,unit,pack_size,supplier_id,is_active').order('name')),
    q<Pick<Supplier, 'id' | 'name'>[]>(supabase.from('suppliers').select('id,name').eq('is_active', true).order('name')),
    loadPeople(),
    loadLocation(),
  ])
  return { purchases, products, suppliers, people, location }
}

/** The supplier link comes back as one object (or, for an untyped client, a one-item list). */
const supplierOf = (p: PurchaseRow) => (Array.isArray(p.suppliers) ? p.suppliers[0]?.name : p.suppliers?.name) ?? null

const total = (p: PurchaseRow) => p.purchase_items.reduce((sum, i) => sum + Number(i.line_total), 0)

export default function PurchasesPage() {
  const { data, error, loading, reload } = useLoad(load)
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [open, setOpen] = useState<string | null>(null)

  const productName = useMemo(() => new Map(data?.products.map((p) => [p.id, p])), [data])
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data?.purchases ?? []).filter(
      (p) =>
        (!from || p.purchase_date >= from) &&
        (!to || p.purchase_date <= to) &&
        (!term || (supplierOf(p) ?? '').toLowerCase().includes(term) || (p.reference ?? '').toLowerCase().includes(term)),
    )
  }, [data, search, from, to])
  const sum = rows.reduce((s, p) => s + total(p), 0)

  const formOpen = params.get('new') === '1'
  const closeForm = () => setParams({}, { replace: true })

  const addButton = (
    <button onClick={() => setParams({ new: '1' })} className={primaryBtn}>
      <Plus size={18} /> Record purchase
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Goods you buy from suppliers. Each purchase adds to your stock and sets what it cost you.</p>
        {!!data?.purchases.length && addButton}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.purchases.length ? (
        <EmptyState
          icon={<Truck size={24} />}
          title="No purchases yet"
          text="Record what you buy with the supplier, quantity and cost, and your stock goes up automatically."
          action={addButton}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="relative min-w-52 flex-1 sm:max-w-xs">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className={`${fieldClass} pl-9`} placeholder="Search supplier or reference" aria-label="Search purchases" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <label className="text-xs font-semibold text-muted">
              From
              <input type="date" className={`${fieldClass} mt-1 w-40`} value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="text-xs font-semibold text-muted">
              To
              <input type="date" className={`${fieldClass} mt-1 w-40`} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <div className="ml-auto text-right">
              <div className="text-xs font-semibold text-muted">{rows.length} purchase{rows.length === 1 ? '' : 's'}</div>
              <div className="font-display text-xl font-bold">{formatNaira(sum)}</div>
            </div>
          </div>

          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {rows.map((p) => {
              const expanded = open === p.id
              return (
                <li key={p.id}>
                  <button
                    onClick={() => setOpen(expanded ? null : p.id)}
                    aria-expanded={expanded}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-highlight/40"
                  >
                    {expanded ? <ChevronDown size={18} className="shrink-0 text-muted" /> : <ChevronRight size={18} className="shrink-0 text-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{supplierOf(p) ?? 'No supplier'}</div>
                      <div className="text-xs text-muted">
                        {formatDate(p.purchase_date)} · {p.purchase_items.length} item{p.purchase_items.length === 1 ? '' : 's'}
                        {p.reference && ` · ${p.reference}`}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-bold">{formatNaira(total(p))}</div>
                  </button>
                  {expanded && (
                    <div className="border-t border-border bg-bg/60 px-4 py-3 sm:pl-11">
                      <table className="w-full text-sm">
                        <tbody>
                          {p.purchase_items.map((i, idx) => {
                            const prod = productName.get(i.product_id)
                            return (
                              <tr key={idx}>
                                <td className="py-1 font-semibold">{prod?.name ?? 'Product'}</td>
                                <td className="py-1 text-right text-muted">{formatQty(i.quantity)} {prod?.unit} × {formatNaira(i.unit_cost)}</td>
                                <td className="py-1 pl-4 text-right font-semibold">{formatNaira(i.line_total)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {p.note && <p className="mt-2 text-xs text-muted">Note: {p.note}</p>}
                      <p className="mt-2 text-xs text-muted">Recorded by {(p.created_by && data.people.get(p.created_by)) || 'a team member'}</p>
                    </div>
                  )}
                </li>
              )
            })}
            {!rows.length && <li className="px-4 py-10 text-center text-sm text-muted">No purchases match.</li>}
          </ul>
        </>
      )}

      {formOpen && data && (
        <PurchaseForm
          products={data.products.filter((p) => p.is_active)}
          suppliers={data.suppliers}
          locationId={data.location?.id ?? null}
          presetProductId={params.get('product')}
          onClose={closeForm}
          onDone={() => {
            closeForm()
            reload()
          }}
        />
      )}
    </div>
  )
}
