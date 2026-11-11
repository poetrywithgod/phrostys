import { useMemo, useState, type FormEvent } from 'react'
import { BellOff, Cake, Mail, Pencil, Phone, Plus, Search, TrendingDown, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q, useLoad } from '../../lib/db'
import { formatDate, formatNaira } from '../../lib/format'
import { EmptyState, ErrorNote, Field, Modal, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'

interface Stat {
  customer_id: string
  full_name: string
  phone: string | null
  email: string | null
  birthday: string | null
  opted_out: boolean
  order_count: number
  total_spent: number
  last_purchase_at: string | null
  avg_gap_days: number | null
  days_since_last: number | null
  is_regular: boolean
  is_lapsing: boolean
  notes: string | null
}

const load = async () => {
  const [stats, notes] = await Promise.all([
    q<Omit<Stat, 'notes'>[]>(
      supabase
        .from('v_customer_stats')
        .select('customer_id,full_name,phone,email,birthday,opted_out,order_count,total_spent,last_purchase_at,avg_gap_days,days_since_last,is_regular,is_lapsing')
        .order('full_name'),
    ),
    q<{ id: string; notes: string | null }[]>(supabase.from('customers').select('id,notes')),
  ])
  const n = new Map(notes.map((r) => [r.id, r.notes]))
  return stats.map((s): Stat => ({ ...s, notes: n.get(s.customer_id) ?? null }))
}

type Filter = 'all' | 'regular' | 'losing' | 'birthdays'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'regular', label: 'Regulars' },
  { id: 'losing', label: 'Going quiet' },
  { id: 'birthdays', label: 'Birthdays this month' },
]

/** Days until the next birthday (0 = today). Only month and day matter, not the birth year. */
function daysToBirthday(iso: string): number {
  const [, m, d] = iso.split('-').map(Number)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let next = new Date(today.getFullYear(), m - 1, d)
  if (next < today) next = new Date(today.getFullYear() + 1, m - 1, d)
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}
const birthdayLabel = (iso: string) =>
  new Date(2000, Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

interface Draft {
  id?: string
  full_name: string
  phone: string
  email: string
  birthday: string
  opted_out: boolean
  notes: string
}
const blank: Draft = { full_name: '', phone: '', email: '', birthday: '', opted_out: false, notes: '' }

function CustomerForm({ initial, onDone, onClose }: { initial: Draft; onDone: () => void; onClose: () => void }) {
  const [d, setD] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = {
      full_name: d.full_name.trim(),
      phone: d.phone.trim() || null,
      email: d.email.trim() || null,
      birthday: d.birthday || null,
      opted_out: d.opted_out,
      notes: d.notes.trim() || null,
    }
    try {
      await q(d.id ? supabase.from('customers').update(row).eq('id', d.id) : supabase.from('customers').insert(row))
      onDone()
    } catch (err) {
      const code = (err as { code?: string }).code
      setError(code === '23505' ? 'Another customer already has that phone number or email.' : explain(err, 'customer'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Full name">
        <input required autoFocus className={fieldClass} value={d.full_name} onChange={(e) => set('full_name', e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number" hint="Reminders and birthday messages go here.">
          <input type="tel" inputMode="tel" className={fieldClass} value={d.phone} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="Email (optional)">
          <input type="email" className={fieldClass} value={d.email} onChange={(e) => set('email', e.target.value)} />
        </Field>
      </div>
      <Field label="Birthday (optional)" hint="We send a birthday message. The year is not needed, but the date picker asks for one.">
        <input type="date" className={fieldClass} value={d.birthday} onChange={(e) => set('birthday', e.target.value)} />
      </Field>
      <Field label="Notes">
        <textarea rows={2} className={fieldClass} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </Field>
      <label className="flex items-start gap-3 text-sm font-semibold">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--primary)]" checked={d.opted_out} onChange={(e) => set('opted_out', e.target.checked)} />
        <span>
          Do not send this customer messages
          <span className="block text-xs font-normal text-muted">Tick this if they asked to stop receiving reminders and birthday messages.</span>
        </span>
      </label>
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <button type="submit" disabled={busy || !d.full_name.trim()} className={primaryBtn}>{busy ? 'Saving…' : 'Save customer'}</button>
      </div>
    </form>
  )
}

export default function CustomersPage() {
  const { data, error, loading, reload } = useLoad(load)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)

  const counts = useMemo(() => {
    const rows = data ?? []
    return {
      all: rows.length,
      regular: rows.filter((r) => r.is_regular).length,
      losing: rows.filter((r) => r.is_lapsing).length,
      birthdays: rows.filter((r) => r.birthday && Number(r.birthday.slice(5, 7)) === new Date().getMonth() + 1).length,
    }
  }, [data])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data ?? [])
      .filter((r) => {
        if (filter === 'regular') return r.is_regular
        if (filter === 'losing') return r.is_lapsing
        if (filter === 'birthdays') return r.birthday && Number(r.birthday.slice(5, 7)) === new Date().getMonth() + 1
        return true
      })
      .filter((r) => !term || r.full_name.toLowerCase().includes(term) || (r.phone ?? '').includes(term))
      .sort((a, b) =>
        filter === 'losing'
          ? Number(b.total_spent) - Number(a.total_spent)
          : filter === 'birthdays'
            ? daysToBirthday(a.birthday!) - daysToBirthday(b.birthday!)
            : a.full_name.localeCompare(b.full_name),
      )
  }, [data, filter, search])

  const addButton = (
    <button onClick={() => setDraft(blank)} className={`${primaryBtn} shrink-0 whitespace-nowrap`}>
      <Plus size={18} /> Add customer
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Everyone who buys from you, what they spend, and who has gone quiet.</p>
        {!!data?.length && addButton}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.length ? (
        <EmptyState icon={<Users size={24} />} title="No customers yet" text="Add your customers to track what they buy, give credit and send them reminders." action={addButton} />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Customer groups" className="flex flex-wrap gap-1 rounded-full border border-border bg-surface p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === f.id ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}
                >
                  {f.label} <span className="opacity-70">{counts[f.id]}</span>
                </button>
              ))}
            </div>
            <label className="relative block sm:w-64">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input aria-label="Search customers" placeholder="Search name or phone" className={`${fieldClass} pl-9`} value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>

          {filter === 'losing' && (
            <p className="flex items-start gap-2 rounded-xl bg-highlight px-3 py-2 text-sm">
              <TrendingDown size={18} className="mt-0.5 shrink-0 text-warning" />
              Regular customers who have not bought in a while, biggest spenders first. Call them before they drift away.
            </p>
          )}

          {!rows.length ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface px-4 py-10 text-center text-sm text-muted">Nobody matches this view.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((c) => (
                <li key={c.customer_id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-bold leading-tight">{c.full_name}</h3>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {c.is_lapsing ? (
                        <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">Going quiet</span>
                      ) : c.is_regular ? (
                        <span className="rounded-full bg-highlight px-2.5 py-0.5 text-xs font-semibold text-primary">Regular</span>
                      ) : c.order_count === 0 ? (
                        <span className="rounded-full bg-border px-2.5 py-0.5 text-xs font-semibold text-muted">No purchase yet</span>
                      ) : null}
                      {c.opted_out && (
                        <span title="Will not receive messages" className="inline-flex items-center gap-1 rounded-full bg-border px-2.5 py-0.5 text-xs font-semibold text-muted">
                          <BellOff size={12} /> No messages
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 space-y-1 text-sm text-muted">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-2 hover:text-primary"><Phone size={15} /> {c.phone}</a>
                    )}
                    {c.email && <div className="flex items-center gap-2 break-all"><Mail size={15} className="shrink-0" /> {c.email}</div>}
                    {c.birthday && (
                      <div className="flex items-center gap-2">
                        <Cake size={15} /> {birthdayLabel(c.birthday)}
                        {daysToBirthday(c.birthday) <= 14 && (
                          <span className="rounded-full bg-highlight px-2 py-0.5 text-xs font-semibold text-primary">
                            {daysToBirthday(c.birthday) === 0 ? 'Today' : `in ${daysToBirthday(c.birthday)} days`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                    <div><dt className="text-muted">Orders</dt><dd className="mt-0.5 text-sm font-bold">{c.order_count}</dd></div>
                    <div><dt className="text-muted">Spent</dt><dd className="mt-0.5 text-sm font-bold">{formatNaira(c.total_spent)}</dd></div>
                    <div>
                      <dt className="text-muted">Last bought</dt>
                      <dd className="mt-0.5 text-sm font-bold">{c.last_purchase_at ? formatDate(c.last_purchase_at) : '–'}</dd>
                    </div>
                  </dl>
                  {c.is_lapsing && c.days_since_last != null && (
                    <p className="mt-2 text-xs text-warning">
                      {Math.floor(c.days_since_last)} days since the last purchase
                      {c.avg_gap_days ? `, usually buys every ${Math.round(c.avg_gap_days)} days` : ''}.
                    </p>
                  )}
                  {c.notes && <p className="mt-2 text-xs text-muted">{c.notes}</p>}

                  <button
                    onClick={() =>
                      setDraft({
                        id: c.customer_id,
                        full_name: c.full_name,
                        phone: c.phone ?? '',
                        email: c.email ?? '',
                        birthday: c.birthday ?? '',
                        opted_out: c.opted_out,
                        notes: c.notes ?? '',
                      })
                    }
                    className="mt-3 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-primary hover:underline"
                  >
                    <Pencil size={14} /> Edit
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {draft && (
        <Modal title={draft.id ? 'Edit customer' : 'Add customer'} onClose={() => setDraft(null)}>
          <CustomerForm
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
