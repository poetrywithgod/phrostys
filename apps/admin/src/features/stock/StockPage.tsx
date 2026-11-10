import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardCheck, History, ImageOff, Package, Phone, Search, SlidersHorizontal, Truck } from 'lucide-react'
import { useLoad } from '../../lib/db'
import { formatQty } from '../../lib/format'
import { EmptyState, ErrorNote, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'
import { loadStock, type StockRow, type StockStatus } from './data'
import StockPill from './StockPill'
import AdjustModal from './AdjustModal'
import HistoryModal from './HistoryModal'

type Filter = 'all' | 'low' | 'out'

export default function StockPage() {
  const { data, error, loading, reload } = useLoad(loadStock)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [adjusting, setAdjusting] = useState<StockRow | null>(null)
  const [viewing, setViewing] = useState<StockRow | null>(null)

  const active = useMemo(() => (data?.rows ?? []).filter((r) => r.product.is_active), [data])
  const counts = useMemo(() => {
    const c: Record<StockStatus, number> = { ok: 0, low: 0, out: 0 }
    for (const r of active) c[r.status]++
    return c
  }, [active])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = active.filter(
      (r) =>
        (filter === 'all' || (filter === 'low' ? r.status === 'low' : r.status === 'out')) &&
        (!categoryId || r.product.category_id === categoryId) &&
        (!term || r.product.name.toLowerCase().includes(term) || (r.product.sku ?? '').toLowerCase().includes(term)),
    )
    return filter === 'all' ? list : [...list].sort((a, b) => a.quantity - b.quantity)
  }, [active, filter, search, categoryId])

  const tiles: { id: Filter; label: string; value: number; tone: string }[] = [
    { id: 'all', label: 'Products', value: active.length, tone: 'text-text' },
    { id: 'low', label: 'Running low', value: counts.low, tone: 'text-warning' },
    { id: 'out', label: 'Out of stock', value: counts.out, tone: 'text-danger' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">What is on the shelf right now. Stock updates by itself after every purchase and sale.</p>
        <div className="flex gap-2">
          <Link to="/stock/count" className={ghostBtn}>
            <ClipboardCheck size={18} /> Stock count
          </Link>
          <Link to="/purchases?new=1" className={primaryBtn}>
            <Truck size={18} /> Record purchase
          </Link>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !active.length ? (
        <EmptyState
          icon={<Package size={24} />}
          title="No products to count yet"
          text="The owner adds products in Settings. Once they exist, record a purchase or enter opening stock and they will show here."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {tiles.map((t) => (
              <button
                key={t.id}
                onClick={() => setFilter(t.id)}
                aria-pressed={filter === t.id}
                className={`rounded-2xl border bg-surface p-4 text-left transition ${filter === t.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
              >
                <div className="text-xs font-semibold text-muted">{t.label}</div>
                <div className={`mt-1 font-display text-2xl font-bold sm:text-3xl ${t.tone}`}>{t.value}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52 flex-1 sm:max-w-xs">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input className={`${fieldClass} pl-9`} placeholder="Search products" aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className={`${fieldClass} sm:w-52`} aria-label="Filter by category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {data?.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">In stock</th>
                  <th className="px-4 py-3 text-right font-semibold">Reorder at</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.product.id} className="hover:bg-highlight/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {r.photo ? (
                          <img src={r.photo} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
                        ) : (
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-highlight text-muted"><ImageOff size={18} /></span>
                        )}
                        <div>
                          <div className="font-semibold">{r.product.name}</div>
                          <div className="text-xs text-muted">{r.categoryName ?? 'No category'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-right font-bold ${r.status === 'out' ? 'text-danger' : r.status === 'low' ? 'text-warning' : ''}`}>
                      {formatQty(r.quantity)} <span className="font-normal text-muted">{r.product.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{r.product.reorder_level || '—'}</td>
                    <td className="px-4 py-3"><StockPill status={r.status} /></td>
                    <td className="px-4 py-3">
                      {r.supplier ? (
                        <div>
                          <div>{r.supplier.name}</div>
                          {r.supplier.phone && (
                            <a href={`tel:${r.supplier.phone}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
                              <Phone size={12} /> {r.supplier.phone}
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {r.status !== 'ok' && (
                          <Link to={`/purchases?new=1&product=${r.product.id}`} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-highlight">
                            Reorder
                          </Link>
                        )}
                        <button aria-label={`Adjust ${r.product.name}`} onClick={() => setAdjusting(r)} className="rounded-lg p-2 text-muted hover:bg-highlight hover:text-text">
                          <SlidersHorizontal size={17} />
                        </button>
                        <button aria-label={`History of ${r.product.name}`} onClick={() => setViewing(r)} className="rounded-lg p-2 text-muted hover:bg-highlight hover:text-text">
                          <History size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      {filter === 'low' ? 'Nothing is running low.' : 'No products match.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {adjusting && data?.location && (
        <AdjustModal
          row={adjusting}
          locationId={data.location.id}
          onClose={() => setAdjusting(null)}
          onDone={() => {
            setAdjusting(null)
            reload()
          }}
        />
      )}
      {viewing && <HistoryModal productId={viewing.product.id} name={viewing.product.name} unit={viewing.product.unit} onClose={() => setViewing(null)} />}
    </div>
  )
}
