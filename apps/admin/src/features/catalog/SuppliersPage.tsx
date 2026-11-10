import { useState, type FormEvent } from 'react'
import { Pencil, Phone, Plus, Truck } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q, useLoad } from '../../lib/db'
import type { Supplier } from '../../lib/types'
import { EmptyState, ErrorNote, Field, Modal, StatusPill, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'

const loadSuppliers = () =>
  q<Supplier[]>(supabase.from('suppliers').select('id,name,phone,address,notes,is_active').order('name'))

interface Draft {
  id?: string
  name: string
  phone: string
  address: string
  notes: string
  is_active: boolean
}

const blank: Draft = { name: '', phone: '', address: '', notes: '', is_active: true }

function SupplierForm({ initial, onDone, onClose }: { initial: Draft; onDone: () => void; onClose: () => void }) {
  const [d, setD] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = {
      name: d.name.trim(),
      phone: d.phone.trim() || null,
      address: d.address.trim() || null,
      notes: d.notes.trim() || null,
      is_active: d.is_active,
    }
    try {
      await q(d.id ? supabase.from('suppliers').update(row).eq('id', d.id) : supabase.from('suppliers').insert(row))
      onDone()
    } catch (err) {
      setError(explain(err, 'supplier'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Supplier name">
        <input required autoFocus className={fieldClass} value={d.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Phone number">
        <input type="tel" inputMode="tel" className={fieldClass} value={d.phone} onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <Field label="Address">
        <input className={fieldClass} value={d.address} onChange={(e) => set('address', e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea rows={3} className={fieldClass} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <label className="flex items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--primary)]"
          checked={d.is_active}
          onChange={(e) => set('is_active', e.target.checked)}
        />
        Still buying from this supplier
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={ghostBtn}>
          Cancel
        </button>
        <button type="submit" disabled={busy || !d.name.trim()} className={primaryBtn}>
          {busy ? 'Saving…' : 'Save supplier'}
        </button>
      </div>
    </form>
  )
}

export default function SuppliersPage() {
  const { data, error, loading, reload } = useLoad(loadSuppliers)
  const [draft, setDraft] = useState<Draft | null>(null)

  const addButton = (
    <button onClick={() => setDraft(blank)} className={primaryBtn}>
      <Plus size={18} /> Add supplier
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">The people and companies you buy from. Each purchase is linked to one.</p>
        {!!data?.length && addButton}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.length ? (
        <EmptyState
          icon={<Truck size={24} />}
          title="No suppliers yet"
          text="Add the people you buy goods from so purchases and low-stock alerts can point to them."
          action={addButton}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <li key={s.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display font-bold">{s.name}</h3>
                <StatusPill active={s.is_active} />
              </div>
              {s.phone && (
                <a href={`tel:${s.phone}`} className="mt-2 inline-flex items-center gap-2 text-sm text-muted hover:text-primary">
                  <Phone size={15} /> {s.phone}
                </a>
              )}
              {s.address && <p className="mt-1 text-sm text-muted">{s.address}</p>}
              {s.notes && <p className="mt-2 text-xs text-muted">{s.notes}</p>}
              <button
                onClick={() => setDraft({ id: s.id, name: s.name, phone: s.phone ?? '', address: s.address ?? '', notes: s.notes ?? '', is_active: s.is_active })}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                <Pencil size={14} /> Edit
              </button>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <Modal title={draft.id ? 'Edit supplier' : 'Add supplier'} onClose={() => setDraft(null)}>
          <SupplierForm
            initial={draft}
            onClose={() => setDraft(null)}
            onDone={() => {
              setDraft(null)
              reload()
            }}
          />
        </Modal>
      )}
    </div>
  )
}
