import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { Check, MessageSquareReply, Star, Trash2, Undo2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q, useLoad } from '../../lib/db'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../auth/useAuth'
import { EmptyState, ErrorNote, Field, Modal, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'

type Status = 'pending' | 'approved' | 'rejected'

interface Review {
  id: string
  product_id: string | null
  reviewer_name: string
  rating: number
  title: string | null
  body: string
  status: Status
  reply: string | null
  replied_at: string | null
  created_at: string
  products: { name: string } | { name: string }[] | null
}

const productName = (r: Review) => {
  const p = Array.isArray(r.products) ? r.products[0] : r.products
  return p?.name ?? 'The shop'
}

const TABS: { id: Status; label: string }[] = [
  { id: 'pending', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
]

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={16} className={n <= value ? 'fill-warning text-warning' : 'text-border'} />
      ))}
    </span>
  )
}

function ReplyForm({ review, onDone, onClose }: { review: Review; onDone: () => void; onClose: () => void }) {
  const [text, setText] = useState(review.reply ?? '')
  const [approve, setApprove] = useState(review.status !== 'approved')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await q(supabase.rpc('moderate_review', { p_id: review.id, p_status: approve ? 'approved' : review.status, p_reply: text }))
      onDone()
    } catch (err) {
      setError(explain(err, 'reply'))
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-highlight p-3 text-sm">
        <Stars value={review.rating} />
        <p className="mt-1">{review.body}</p>
        <p className="mt-1 text-xs text-muted">{review.reviewer_name}</p>
      </div>
      <Field label="Your reply" hint="Shown under the review on your shop, signed by Phrostys. Leave empty to remove a reply.">
        <textarea rows={3} maxLength={1000} autoFocus className={fieldClass} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      {review.status !== 'approved' && (
        <label className="flex items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={approve} onChange={(e) => setApprove(e.target.checked)} />
          Approve this review too
        </label>
      )}
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <button disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Save reply'}</button>
      </div>
    </form>
  )
}

export default function ReviewsPage() {
  const { profile } = useAuth()
  const isOwner = profile?.role === 'owner'
  const load = useCallback(async () => {
    try {
      return await q<Review[]>(
        supabase
          .from('reviews')
          .select('id,product_id,reviewer_name,rating,title,body,status,reply,replied_at,created_at,products(name)')
          .order('created_at', { ascending: false })
          .limit(500),
      )
    } catch (err) {
      if (['42P01', 'PGRST205'].includes((err as { code?: string }).code ?? '')) return null // SQL not run yet
      throw err
    }
  }, [])
  const { data, error, loading, reload } = useLoad(load)
  const [tab, setTab] = useState<Status>('pending')
  const [replying, setReplying] = useState<Review | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 }
    for (const r of data ?? []) c[r.status] += 1
    return c
  }, [data])
  const rows = (data ?? []).filter((r) => r.status === tab)
  const approved = (data ?? []).filter((r) => r.status === 'approved')
  const average = approved.length ? approved.reduce((s, r) => s + r.rating, 0) / approved.length : 0

  async function setStatus(r: Review, status: Status) {
    setActionError(null)
    try {
      await q(supabase.rpc('moderate_review', { p_id: r.id, p_status: status }))
      reload()
    } catch (err) {
      setActionError(explain(err, 'review'))
    }
  }

  async function remove(r: Review) {
    if (!window.confirm('Delete this review for good? This cannot be undone.')) return
    setActionError(null)
    try {
      await q(supabase.from('reviews').delete().eq('id', r.id))
      reload()
    } catch (err) {
      setActionError(explain(err, 'review'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Customers write reviews on your shop. Nothing is shown to the public until you approve it.</p>
        {!!approved.length && (
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm">
            <Star size={16} className="fill-warning text-warning" />
            <b>{average.toFixed(1)}</b>
            <span className="text-muted">from {approved.length} approved {approved.length === 1 ? 'review' : 'reviews'}</span>
          </div>
        )}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}
      {data === null && <ErrorNote>The reviews table is not in the database yet. Run the 20261110000600_reviews.sql file in the Supabase SQL editor.</ErrorNote>}

      <div role="tablist" aria-label="Review status" className="flex w-fit gap-1 rounded-full border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === t.id ? 'bg-primary text-on-primary' : 'text-muted hover:text-text'}`}>
            {t.label} <span className="opacity-70">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !rows.length ? (
        <EmptyState
          icon={<Star size={24} />}
          title={tab === 'pending' ? 'No reviews waiting' : `No ${tab} reviews`}
          text={tab === 'pending' ? 'When a customer writes a review on your shop it will appear here for you to approve.' : 'Nothing here yet.'}
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Stars value={r.rating} />
                  {r.title && <h3 className="mt-1 font-display font-bold leading-tight">{r.title}</h3>}
                </div>
                <span className="shrink-0 text-xs text-muted">{formatDate(r.created_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
              <p className="mt-2 text-xs text-muted">
                <b className="text-text">{r.reviewer_name}</b> on {productName(r)}
              </p>
              {r.reply && (
                <div className="mt-3 rounded-xl bg-highlight p-3 text-sm">
                  <p className="text-xs font-semibold text-primary">Your reply</p>
                  <p className="mt-0.5 whitespace-pre-line">{r.reply}</p>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3 text-sm font-semibold">
                {r.status !== 'approved' && (
                  <button onClick={() => setStatus(r, 'approved')} className="inline-flex items-center gap-1.5 text-primary hover:underline">
                    {r.status === 'pending' ? <Check size={15} /> : <Undo2 size={15} />} {r.status === 'pending' ? 'Approve' : 'Approve after all'}
                  </button>
                )}
                {r.status !== 'rejected' && (
                  <button onClick={() => setStatus(r, 'rejected')} className="inline-flex items-center gap-1.5 text-danger hover:underline">
                    <X size={15} /> {r.status === 'pending' ? 'Reject' : 'Hide again'}
                  </button>
                )}
                <button onClick={() => setReplying(r)} className="inline-flex items-center gap-1.5 hover:text-primary">
                  <MessageSquareReply size={15} /> {r.reply ? 'Edit reply' : 'Reply'}
                </button>
                {isOwner && (
                  <button onClick={() => remove(r)} className="ml-auto inline-flex items-center gap-1.5 text-muted hover:text-danger">
                    <Trash2 size={15} /> Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {replying && (
        <Modal title="Reply to review" onClose={() => setReplying(null)}>
          <ReplyForm review={replying} onClose={() => setReplying(null)} onDone={() => { setReplying(null); reload() }} />
        </Modal>
      )}
    </div>
  )
}
