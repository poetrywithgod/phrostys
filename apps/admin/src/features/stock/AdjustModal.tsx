import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { explain, q } from '../../lib/db'
import { formatQty } from '../../lib/format'
import { ErrorNote, Field, Modal, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'
import type { StockRow } from './data'

type Mode = 'remove' | 'add' | 'opening'

const REASONS: Record<'remove' | 'add', string[]> = {
  remove: ['Damaged', 'Expired', 'Missing or stolen', 'Miscounted', 'Returned to supplier', 'Other'],
  add: ['Found extra', 'Miscounted', 'Customer return', 'Other'],
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'remove', label: 'Remove stock' },
  { id: 'add', label: 'Add stock' },
  { id: 'opening', label: 'Opening stock' },
]

export default function AdjustModal({
  row, locationId, onClose, onDone,
}: {
  row: StockRow
  locationId: string
  onClose: () => void
  onDone: () => void
}) {
  const { product } = row
  const [mode, setMode] = useState<Mode>('remove')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('Damaged')
  const [note, setNote] = useState('')
  const [cost, setCost] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amount = Number(qty) || 0
  const delta = mode === 'remove' ? -amount : amount
  const after = row.quantity + delta
  const needsReason = mode !== 'opening'
  const reasonList = mode === 'remove' ? REASONS.remove : REASONS.add

  function pick(next: Mode) {
    setMode(next)
    setError(null)
    if (next !== 'opening') setReason(REASONS[next][0])
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (amount <= 0) return setError('Enter how many units.')
    if (mode === 'remove' && amount > row.quantity) return setError(`Only ${formatQty(row.quantity)} ${product.unit} in stock.`)
    if (mode === 'opening' && cost === '') return setError('Enter what each unit cost you, so profit is worked out correctly.')
    if (needsReason && reason === 'Other' && !note.trim()) return setError('Please say what happened.')

    setBusy(true)
    try {
      await q(
        supabase.rpc('adjust_stock', {
          p_product: product.id,
          p_location: locationId,
          p_delta: delta,
          p_kind: mode === 'opening' ? 'opening_stock' : 'adjustment',
          p_reason: mode === 'opening' ? 'Opening stock' : [reason, note.trim()].filter((x) => x && x !== 'Other').join(': ') || note.trim(),
          p_unit_cost: mode !== 'remove' && cost !== '' ? Number(cost) : null,
        }),
      )
      onDone()
    } catch (err) {
      setError(explain(err, 'adjustment'))
      setBusy(false)
    }
  }

  return (
    <Modal title={`Adjust stock · ${product.name}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="rounded-xl bg-highlight px-4 py-3 text-sm">
          In stock now: <span className="font-bold">{formatQty(row.quantity)} {product.unit}</span>
        </div>

        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-full border border-border bg-bg p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => pick(m.id)}
              className={`rounded-full px-2 py-2 text-xs font-semibold transition-colors sm:text-sm ${mode === m.id ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <Field label={`Quantity (${product.unit})`}>
          <input autoFocus type="number" min="0" step="any" inputMode="decimal" className={fieldClass} value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>

        {needsReason ? (
          <>
            <Field label="Reason">
              <select className={fieldClass} value={reason} onChange={(e) => setReason(e.target.value)}>
                {reasonList.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label={reason === 'Other' ? 'What happened?' : 'Note (optional)'}>
              <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </>
        ) : (
          <p className="text-sm text-muted">Use this once per product to enter what you already had on the shelf before using the system.</p>
        )}

        {mode !== 'remove' && (
          <Field
            label={`Cost per ${product.unit} (₦)${mode === 'add' ? ' · optional' : ''}`}
            hint={mode === 'add' ? 'Leave blank to use your current average cost.' : 'What each unit cost you. Needed for correct profit.'}
          >
            <input type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}

        {amount > 0 && (
          <p className="text-sm text-muted">
            Stock will become <span className="font-bold text-text">{formatQty(after)} {product.unit}</span>
          </p>
        )}

        {error && <ErrorNote>{error}</ErrorNote>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Save adjustment'}</button>
        </div>
      </form>
    </Modal>
  )
}
