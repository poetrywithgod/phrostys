import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q, useLoad } from '../../lib/db'
import { formatQty } from '../../lib/format'
import { ErrorNote, Field, fieldClass, primaryBtn } from '../../components/ui'
import { loadStock } from './data'

/** Count what is really on the shelf; the system shows the difference and corrects it with a reason. */
export default function StockCountPage() {
  const { data, error, loading } = useLoad(loadStock)
  const navigate = useNavigate()
  const [counted, setCounted] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data?.rows ?? []).filter((r) => r.product.is_active && (!term || r.product.name.toLowerCase().includes(term)))
  }, [data, search])

  const changes = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((r) => counted[r.product.id] !== undefined && counted[r.product.id] !== '')
        .map((r) => ({ row: r, delta: Number(counted[r.product.id]) - r.quantity }))
        .filter((c) => Number.isFinite(c.delta) && c.delta !== 0),
    [data, counted],
  )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!data?.location || !changes.length) return
    if (!note.trim()) return setMessage('Add a short reason, for example “Monthly shelf count”.')
    setBusy(true)
    setMessage(null)
    const failed: string[] = []
    for (const { row, delta } of changes) {
      try {
        await q(
          supabase.rpc('adjust_stock', {
            p_product: row.product.id,
            p_location: data.location.id,
            p_delta: delta,
            p_kind: 'count_correction',
            p_reason: `Stock count: ${note.trim()}`,
            p_unit_cost: null,
          }),
        )
      } catch (err) {
        failed.push(`${row.product.name} (${explain(err, 'adjustment')})`)
      }
    }
    setBusy(false)
    if (failed.length) setMessage(`Some items were not corrected: ${failed.join('; ')}`)
    else navigate('/stock')
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Link to="/stock" className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-text">
        <ArrowLeft size={16} /> Back to stock
      </Link>
      <div>
        <h2 className="font-display text-xl font-bold">Stock count</h2>
        <p className="text-sm text-muted">Type what you counted on the shelf. Leave a row empty to skip it. Only products that differ are corrected.</p>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <div className="relative max-w-xs">
            <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${fieldClass} pl-9`} placeholder="Search products" aria-label="Search products" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 text-right font-semibold">System says</th>
                  <th className="px-4 py-3 text-right font-semibold">You counted</th>
                  <th className="px-4 py-3 text-right font-semibold">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const value = counted[r.product.id] ?? ''
                  const diff = value === '' ? null : Number(value) - r.quantity
                  return (
                    <tr key={r.product.id}>
                      <td className="px-4 py-2.5 font-semibold">{r.product.name}</td>
                      <td className="px-4 py-2.5 text-right text-muted">{formatQty(r.quantity)} {r.product.unit}</td>
                      <td className="px-4 py-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          inputMode="decimal"
                          aria-label={`Counted ${r.product.name}`}
                          className={`${fieldClass} ml-auto w-28 text-right`}
                          value={value}
                          onChange={(e) => setCounted((c) => ({ ...c, [r.product.id]: e.target.value }))}
                        />
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${diff == null || diff === 0 ? 'text-muted' : diff > 0 ? 'text-primary' : 'text-danger'}`}>
                        {diff == null ? '—' : diff === 0 ? 'Matches' : `${diff > 0 ? '+' : ''}${formatQty(diff)}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="max-w-md">
            <Field label="Reason for the corrections" hint={changes.length ? `${changes.length} product${changes.length === 1 ? '' : 's'} will be corrected.` : 'No differences yet.'}>
              <input className={fieldClass} placeholder="e.g. Monthly shelf count" value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>

          {message && <ErrorNote>{message}</ErrorNote>}
          <button type="submit" disabled={busy || !changes.length} className={primaryBtn}>
            {busy ? 'Saving…' : changes.length ? `Correct ${changes.length} product${changes.length === 1 ? '' : 's'}` : 'Nothing to correct'}
          </button>
        </>
      )}
    </form>
  )
}
