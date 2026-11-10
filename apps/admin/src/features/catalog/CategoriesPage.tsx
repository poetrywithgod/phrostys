import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q, useLoad } from '../../lib/db'
import type { Category } from '../../lib/types'
import { EmptyState, ErrorNote, fieldClass, primaryBtn } from '../../components/ui'

const loadCategories = () => q<Category[]>(supabase.from('categories').select('id,name').order('name'))

export default function CategoriesPage() {
  const { data, error, loading, reload } = useLoad(loadCategories)
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function run(action: () => PromiseLike<unknown>) {
    setBusy(true)
    setMessage(null)
    try {
      await action()
      reload()
      return true
    } catch (err) {
      setMessage(explain(err, 'category'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const clean = name.trim()
    if (!clean) return
    if (await run(() => q(supabase.from('categories').insert({ name: clean })))) setName('')
  }

  async function onSaveEdit() {
    if (!editing || !editing.name.trim()) return
    if (await run(() => q(supabase.from('categories').update({ name: editing.name.trim() }).eq('id', editing.id)))) setEditing(null)
  }

  async function onDelete(c: Category) {
    if (!window.confirm(`Remove “${c.name}”? Products in it will simply have no category.`)) return
    await run(() => q(supabase.from('categories').delete().eq('id', c.id)))
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-muted">Groups that keep your products tidy, for example Grains, Drinks or Toiletries.</p>

      <form onSubmit={onAdd} className="flex gap-2">
        <input
          className={fieldClass}
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="New category name"
        />
        <button type="submit" disabled={busy || !name.trim()} className={`${primaryBtn} shrink-0`}>
          <Plus size={18} /> Add
        </button>
      </form>

      {(message || error) && <ErrorNote>{message ?? error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.length ? (
        <EmptyState icon={<Tags size={24} />} title="No categories yet" text="Add your first category above." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {data.map((c) => (
            <li key={c.id} className="flex items-center gap-2 px-4 py-3">
              {editing?.id === c.id ? (
                <>
                  <input
                    autoFocus
                    className={fieldClass}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && onSaveEdit()}
                    aria-label="Category name"
                  />
                  <button aria-label="Save" onClick={onSaveEdit} className="rounded-lg p-2 text-primary hover:bg-highlight">
                    <Check size={18} />
                  </button>
                  <button aria-label="Cancel" onClick={() => setEditing(null)} className="rounded-lg p-2 text-muted hover:bg-highlight">
                    <X size={18} />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm font-semibold">{c.name}</span>
                  <button
                    aria-label={`Rename ${c.name}`}
                    onClick={() => setEditing({ id: c.id, name: c.name })}
                    className="rounded-lg p-2 text-muted hover:bg-highlight hover:text-text"
                  >
                    <Pencil size={17} />
                  </button>
                  <button
                    aria-label={`Remove ${c.name}`}
                    onClick={() => onDelete(c)}
                    className="rounded-lg p-2 text-muted hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={17} />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
