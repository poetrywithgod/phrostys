import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q } from '../../lib/db'
import { formatNaira, todayISO } from '../../lib/format'
import { ErrorNote, Field, Modal, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'
import type { Product, Supplier } from '../../lib/types'

type ProductLite = Pick<Product, 'id' | 'name' | 'unit' | 'pack_size' | 'supplier_id'>

interface Line {
  key: string
  product_id: string
  quantity: string
  unit_cost: string
}

const newLine = (product_id = ''): Line => ({ key: crypto.randomUUID(), product_id, quantity: '', unit_cost: '' })
const label = (p: ProductLite) => `${p.name} (${p.unit}${p.pack_size !== 1 ? ` × ${p.pack_size}` : ''})`

export default function PurchaseForm({
  products, suppliers, locationId, presetProductId, onClose, onDone,
}: {
  products: ProductLite[]
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  locationId: string | null
  presetProductId: string | null
  onClose: () => void
  onDone: () => void
}) {
  const preset = products.find((p) => p.id === presetProductId)
  const [supplierId, setSupplierId] = useState(preset?.supplier_id ?? '')
  const [date, setDate] = useState(todayISO())
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<Line[]>([newLine(preset?.id)])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const byId = new Map(products.map((p) => [p.id, p]))
  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const lineTotal = (l: Line) => (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0)
  const grand = lines.reduce((s, l) => s + lineTotal(l), 0)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!locationId) return setError('No shop location is set up yet. Please contact support.')
    if (!products.length) return setError('There are no products to buy yet. Ask the owner to add them in Settings.')
    for (const [i, l] of lines.entries()) {
      if (!l.product_id) return setError(`Line ${i + 1}: choose a product.`)
      if (!(Number(l.quantity) > 0)) return setError(`Line ${i + 1}: enter a quantity.`)
      if (l.unit_cost === '' || Number(l.unit_cost) < 0) return setError(`Line ${i + 1}: enter what each unit cost.`)
    }
    setBusy(true)
    try {
      await q(
        supabase.rpc('record_purchase', {
          p_location: locationId,
          p_supplier: supplierId || null,
          p_date: date,
          p_reference: reference.trim() || null,
          p_note: note.trim() || null,
          p_items: lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_cost: Number(l.unit_cost) })),
        }),
      )
      onDone()
    } catch (err) {
      setError(explain(err, 'purchase'))
      setBusy(false)
    }
  }

  return (
    <Modal title="Record purchase" onClose={onClose} wide>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Supplier">
            <select className={fieldClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
              <option value="">No supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Date bought">
            <input required type="date" max={todayISO()} className={fieldClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Invoice or reference">
            <input className={fieldClass} placeholder="Optional" value={reference} onChange={(e) => setReference(e.target.value)} />
          </Field>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold">What you bought</div>
          <ul className="space-y-3">
            {lines.map((l) => {
              const prod = byId.get(l.product_id)
              return (
                <li key={l.key} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_7rem_9rem_auto] sm:items-end">
                  <Field label="Product">
                    <select className={fieldClass} value={l.product_id} onChange={(e) => setLine(l.key, { product_id: e.target.value })}>
                      <option value="">Choose a product</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{label(p)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label={prod ? `Qty (${prod.unit})` : 'Quantity'}>
                    <input type="number" min="0" step="any" inputMode="decimal" className={fieldClass} value={l.quantity} onChange={(e) => setLine(l.key, { quantity: e.target.value })} />
                  </Field>
                  <Field label="Cost each (₦)">
                    <input type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={l.unit_cost} onChange={(e) => setLine(l.key, { unit_cost: e.target.value })} />
                  </Field>
                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-sm font-bold sm:hidden">{formatNaira(lineTotal(l))}</span>
                    <button
                      type="button"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                      className="rounded-lg p-2.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-30"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
          <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <Plus size={16} /> Add another product
          </button>
        </div>

        <Field label="Note">
          <input className={fieldClass} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div className="flex items-center justify-between rounded-xl bg-highlight px-4 py-3">
          <span className="text-sm font-semibold">Total</span>
          <span className="font-display text-xl font-bold">{formatNaira(grand)}</span>
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Save purchase'}</button>
        </div>
      </form>
    </Modal>
  )
}
