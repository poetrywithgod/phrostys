import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { explain, q } from '../../lib/db'
import { formatDate, formatNaira } from '../../lib/format'
import { ErrorNote, Field, Modal, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'
import type { OpenSale, PaymentMethod } from '../../lib/types'
import { allocate } from './allocate'

export default function PaymentModal({
  who, sales, onClose, onDone,
}: {
  who: string
  sales: OpenSale[]
  onClose: () => void
  onDone: () => void
}) {
  const owed = sales.reduce((s, x) => s + Number(x.balance), 0)
  const [amount, setAmount] = useState(String(owed))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const value = Number(amount) || 0
  const parts = allocate(sales, value)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (value <= 0) return setError('Enter the amount received.')
    if (value > owed) return setError(`That is more than the ${formatNaira(owed)} owed.`)
    setBusy(true)
    let done = 0
    try {
      for (const { sale, pay } of parts) {
        await q(supabase.rpc('record_sale_payment', { p_sale: sale.id, p_amount: pay, p_method: method, p_note: note.trim() || null }))
        done++
      }
      onDone()
    } catch (err) {
      setError(`${explain(err, 'payment')}${done ? ` ${done} earlier payment${done === 1 ? ' was' : 's were'} already saved.` : ''}`)
      setBusy(false)
      if (done) onDone()
    }
  }

  return (
    <Modal title={`Record payment · ${who}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl bg-highlight px-4 py-3 text-sm">
          Still owed: <span className="font-bold">{formatNaira(owed)}</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Amount received (₦)">
            <input autoFocus type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Paid by">
            <select className={fieldClass} value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              <option value="cash">Cash</option>
              <option value="transfer">Transfer</option>
              <option value="card">Card</option>
            </select>
          </Field>
        </div>
        <Field label="Note">
          <input className={fieldClass} placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        {parts.length > 0 && (
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="mb-1 text-xs font-semibold text-muted">This covers, oldest first</div>
            <ul className="space-y-1">
              {parts.map(({ sale, pay }) => (
                <li key={sale.id} className="flex justify-between gap-3">
                  <span>Sale #{sale.sale_number} · {formatDate(sale.sold_at)}</span>
                  <span className="font-semibold">{formatNaira(pay)}{pay >= Number(sale.balance) ? ' · cleared' : ` of ${formatNaira(sale.balance)}`}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 border-t border-border pt-2 text-muted">
              Left owing after this: <span className="font-bold text-text">{formatNaira(Math.max(owed - value, 0))}</span>
            </div>
          </div>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Save payment'}</button>
        </div>
      </form>
    </Modal>
  )
}
