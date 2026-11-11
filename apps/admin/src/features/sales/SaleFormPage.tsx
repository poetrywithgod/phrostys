import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, UserPlus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q, useLoad } from '../../lib/db'
import { formatNaira, formatQty } from '../../lib/format'
import { ErrorNote, Field, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'
import type { Customer, PaymentMethod, PaymentType } from '../../lib/types'
import { loadStock, type StockRow } from '../stock/data'

const loadForm = async () => {
  const [stock, customers] = await Promise.all([
    loadStock(),
    q<Customer[]>(supabase.from('customers').select('id,full_name,phone').order('full_name')),
  ])
  return { ...stock, customers }
}

interface Line {
  key: string
  product_id: string
  quantity: string
  price: string | null // null = use the price list
}
const newLine = (): Line => ({ key: crypto.randomUUID(), product_id: '', quantity: '1', price: null })

const TYPES: { id: PaymentType; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'credit', label: 'Credit' },
]

export default function SaleFormPage() {
  const { data, error: loadError, loading, reload } = useLoad(loadForm)
  const navigate = useNavigate()

  const [customerId, setCustomerId] = useState('')
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [list, setList] = useState<'retail' | 'wholesale'>('retail')
  const [lines, setLines] = useState<Line[]>([newLine()])
  const [type, setType] = useState<PaymentType>('cash')
  const [deposit, setDeposit] = useState('')
  const [depositMethod, setDepositMethod] = useState<Exclude<PaymentMethod, 'card'>>('cash')
  const [channel, setChannel] = useState<'shop' | 'phone_chat'>('shop')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rows = useMemo(() => (data?.rows ?? []).filter((r) => r.product.is_active), [data])
  const byId = useMemo(() => new Map(rows.map((r) => [r.product.id, r])), [rows])

  const listPrice = (r: StockRow) => (list === 'wholesale' && r.product.wholesale_price != null ? r.product.wholesale_price : r.product.retail_price)
  const priceOf = (l: Line) => {
    if (l.price != null) return Number(l.price) || 0
    const r = byId.get(l.product_id)
    return r ? listPrice(r) : 0
  }
  const totalOf = (l: Line) => (Number(l.quantity) || 0) * priceOf(l)
  const total = lines.reduce((s, l) => s + totalOf(l), 0)
  const paidNow = type === 'credit' ? Math.min(Number(deposit) || 0, total) : total
  const balance = total - paidNow

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))

  async function addCustomer() {
    if (!newName.trim()) return
    setError(null)
    try {
      const c = await q<Customer>(
        supabase.from('customers').insert({ full_name: newName.trim(), phone: newPhone.trim() || null }).select('id,full_name,phone').single(),
      )
      setCustomerId(c.id)
      setAdding(false)
      setNewName('')
      setNewPhone('')
      reload()
    } catch (err) {
      setError(explain(err, 'customer'))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!data?.location) return setError('No shop location is set up yet. Please contact support.')
    if (type === 'credit' && !customerId) return setError('Choose or add the customer. A credit sale must be linked to someone who will pay later.')
    for (const [i, l] of lines.entries()) {
      const r = byId.get(l.product_id)
      if (!r) return setError(`Line ${i + 1}: choose a product.`)
      const qty = Number(l.quantity)
      if (!(qty > 0)) return setError(`Line ${i + 1}: enter a quantity.`)
      if (qty > r.quantity) return setError(`${r.product.name}: only ${formatQty(r.quantity)} ${r.product.unit} in stock.`)
    }
    if (type === 'credit' && (Number(deposit) || 0) > total) return setError('The amount paid now cannot be more than the sale total.')

    const payments = type === 'credit' && paidNow > 0 ? [{ amount: paidNow, method: depositMethod }] : []
    setBusy(true)
    try {
      await q(
        supabase.rpc('record_sale', {
          p_location: data.location.id,
          p_customer: customerId || null,
          p_channel: channel,
          p_payment_type: type,
          p_items: lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_price: priceOf(l) })),
          p_payments: payments,
          p_note: note.trim() || null,
        }),
      )
      navigate('/sales', { state: { saved: true } })
    } catch (err) {
      setError(explain(err, 'sale'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-5">
      <Link to="/sales" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft size={16} /> Back to sales
      </Link>
      <h2 className="font-display text-xl font-bold">New sale</h2>

      {loadError && <ErrorNote>{loadError}</ErrorNote>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !rows.length ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
          There are no products yet. The owner adds them in Settings, then you can sell them here.
        </p>
      ) : (
        <>
          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Customer">
                  <select className={fieldClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                    <option value="">Walk-in customer</option>
                    {data?.customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ''}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <button type="button" onClick={() => setAdding((v) => !v)} className={ghostBtn}>
                <UserPlus size={18} /> <span className="hidden sm:inline">New customer</span>
              </button>
            </div>
            {adding && (
              <div className="grid gap-3 rounded-xl bg-bg p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Name">
                  <input className={fieldClass} value={newName} onChange={(e) => setNewName(e.target.value)} />
                </Field>
                <Field label="Phone">
                  <input type="tel" inputMode="tel" className={fieldClass} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </Field>
                <button type="button" onClick={addCustomer} disabled={!newName.trim()} className={primaryBtn}>Save customer</button>
              </div>
            )}
          </section>

          <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Items</h3>
              <div role="tablist" className="flex gap-1 rounded-full border border-border bg-bg p-1 text-xs font-semibold">
                {(['retail', 'wholesale'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="tab"
                    aria-selected={list === l}
                    onClick={() => setList(l)}
                    className={`rounded-full px-3 py-1 capitalize transition-colors ${list === l ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <ul className="space-y-3">
              {lines.map((l) => {
                const r = byId.get(l.product_id)
                const qty = Number(l.quantity) || 0
                return (
                  <li key={l.key} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_6rem_8rem_auto] sm:items-start">
                    <Field label="Product" hint={r ? `${formatQty(r.quantity)} ${r.product.unit} in stock` : undefined}>
                      <select className={fieldClass} value={l.product_id} onChange={(e) => setLine(l.key, { product_id: e.target.value, price: null })}>
                        <option value="">Choose a product</option>
                        {rows.map((x) => (
                          <option key={x.product.id} value={x.product.id} disabled={x.quantity <= 0}>
                            {x.product.name}{x.quantity <= 0 ? ' (out of stock)' : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label={r ? `Qty (${r.product.unit})` : 'Quantity'}>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        className={`${fieldClass} ${r && qty > r.quantity ? 'border-danger' : ''}`}
                        value={l.quantity}
                        onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                      />
                    </Field>
                    <Field label="Price each (₦)">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        className={fieldClass}
                        value={l.price ?? (r ? String(listPrice(r)) : '')}
                        onChange={(e) => setLine(l.key, { price: e.target.value })}
                      />
                    </Field>
                    <div className="flex items-center justify-between gap-2 sm:mt-7 sm:justify-end">
                      <span className="text-sm font-bold">{formatNaira(totalOf(l))}</span>
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
            <button type="button" onClick={() => setLines((ls) => [...ls, newLine()])} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              <Plus size={16} /> Add another product
            </button>
          </section>

          <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <div>
              <h3 className="mb-2 text-sm font-semibold">How is the customer paying?</h3>
              <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full border border-border bg-bg p-1">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={type === t.id}
                    onClick={() => setType(t.id)}
                    className={`rounded-full py-2 text-sm font-semibold transition-colors ${type === t.id ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {type === 'credit' && (
              <div className="space-y-3 rounded-xl bg-bg p-3">
                <p className="text-sm text-muted">
                  The unpaid balance goes onto the debtors list{customerId ? '' : ' — choose the customer above first'}.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Paid now (₦)" hint="Optional deposit.">
                    <input type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
                  </Field>
                  <Field label="Deposit paid by">
                    <select className={fieldClass} value={depositMethod} onChange={(e) => setDepositMethod(e.target.value as 'cash' | 'transfer')}>
                      <option value="cash">Cash</option>
                      <option value="transfer">Transfer</option>
                    </select>
                  </Field>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Where did this order come from?">
                <select className={fieldClass} value={channel} onChange={(e) => setChannel(e.target.value as 'shop' | 'phone_chat')}>
                  <option value="shop">In the shop</option>
                  <option value="phone_chat">Phone or chat order</option>
                </select>
              </Field>
              <Field label="Note">
                <input className={fieldClass} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </div>
          </section>

          <div className="sticky bottom-0 -mx-4 space-y-3 border-t border-border bg-bg/95 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-surface">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs font-semibold text-muted">Total</div>
                <div className="font-display text-2xl font-bold">{formatNaira(total)}</div>
              </div>
              {type === 'credit' && (
                <div className="text-right text-sm">
                  <div className="text-muted">Paid now {formatNaira(paidNow)}</div>
                  <div className="font-bold text-warning">Owes {formatNaira(balance)}</div>
                </div>
              )}
            </div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <button type="submit" disabled={busy || total <= 0} className={`${primaryBtn} w-full py-3.5 text-base`}>
              {busy ? 'Saving…' : 'Record sale'}
            </button>
          </div>
        </>
      )}
    </form>
  )
}
