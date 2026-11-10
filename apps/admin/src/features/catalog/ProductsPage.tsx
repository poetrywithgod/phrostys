import { useMemo, useRef, useState, type FormEvent } from 'react'
import { ImageOff, Package, Pencil, Plus, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { explain, q, useLoad } from '../../lib/db'
import { formatNaira } from '../../lib/format'
import { IMAGE_BUCKET, extensionFor, imageUrl } from '../../lib/images'
import type { Category, Product, ProductImage, Supplier } from '../../lib/types'
import PhotoPicker, { type PhotoItem } from './PhotoPicker'
import { EmptyState, ErrorNote, Field, Modal, StatusPill, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'

const loadCatalog = async () => {
  const [products, categories, suppliers, images] = await Promise.all([
    q<Product[]>(
      supabase
        .from('products')
        .select('id,name,sku,category_id,supplier_id,unit,pack_size,reorder_level,retail_price,wholesale_price,is_active')
        .order('name'),
    ),
    q<Category[]>(supabase.from('categories').select('id,name').order('name')),
    q<Pick<Supplier, 'id' | 'name'>[]>(supabase.from('suppliers').select('id,name').order('name')),
    q<ProductImage[]>(supabase.from('product_images').select('id,product_id,path,sort_order').order('sort_order')),
  ])
  return { products, categories, suppliers, images }
}

const UNITS = ['bag', 'carton', 'kg', 'piece', 'pack', 'bottle', 'litre', 'crate', 'dozen']

interface Draft {
  id?: string
  name: string
  sku: string
  category_id: string
  supplier_id: string
  unit: string
  pack_size: string
  reorder_level: string
  retail_price: string
  wholesale_price: string
  is_active: boolean
}

const blank: Draft = {
  name: '', sku: '', category_id: '', supplier_id: '', unit: 'piece',
  pack_size: '1', reorder_level: '0', retail_price: '', wholesale_price: '', is_active: true,
}

const fromProduct = (p: Product): Draft => ({
  id: p.id,
  name: p.name,
  sku: p.sku ?? '',
  category_id: p.category_id ?? '',
  supplier_id: p.supplier_id ?? '',
  unit: p.unit,
  pack_size: String(p.pack_size),
  reorder_level: String(p.reorder_level),
  retail_price: String(p.retail_price),
  wholesale_price: p.wholesale_price == null ? '' : String(p.wholesale_price),
  is_active: p.is_active,
})

function ProductForm({
  initial, categories, suppliers, images, onDone, onClose,
}: {
  initial: Draft
  categories: Category[]
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  images: ProductImage[]
  onDone: () => void
  onClose: () => void
}) {
  const [d, setD] = useState(initial)
  const [photos, setPhotos] = useState<PhotoItem[]>(() =>
    images.map((i) => ({ key: i.id, id: i.id, path: i.path, url: imageUrl(i.path) })),
  )
  const saved = useRef<{ productId: string | undefined; photos: ProductImage[] }>({ productId: initial.id, photos: images })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = {
      name: d.name.trim(),
      sku: d.sku.trim() || null,
      category_id: d.category_id || null,
      supplier_id: d.supplier_id || null,
      unit: d.unit.trim(),
      pack_size: Number(d.pack_size),
      reorder_level: Number(d.reorder_level),
      retail_price: Number(d.retail_price),
      wholesale_price: d.wholesale_price === '' ? null : Number(d.wholesale_price),
      is_active: d.is_active,
    }
    try {
      let productId = saved.current.productId
      if (productId) {
        await q(supabase.from('products').update(row).eq('id', productId))
      } else {
        productId = (await q<{ id: string }>(supabase.from('products').insert(row).select('id').single())).id
        saved.current.productId = productId
      }
      await savePhotos(productId)
      onDone()
    } catch (err) {
      setError(
        saved.current.productId && !initial.id
          ? 'The product was saved, but a photo could not be uploaded. Press Save again to retry.'
          : explain(err, 'product'),
      )
      setBusy(false)
    }
  }

  /** Removes dropped photos, uploads new ones, then writes the final order (first = cover). */
  async function savePhotos(productId: string) {
    const keepIds = new Set(photos.filter((p) => p.id).map((p) => p.id))
    const dropped = saved.current.photos.filter((p) => !keepIds.has(p.id))
    if (dropped.length) {
      await q(supabase.from('product_images').delete().in('id', dropped.map((p) => p.id)))
      await supabase.storage.from(IMAGE_BUCKET).remove(dropped.map((p) => p.path))
      saved.current.photos = saved.current.photos.filter((p) => keepIds.has(p.id))
    }

    const current = [...photos]
    for (let i = 0; i < current.length; i++) {
      const item = current[i]
      if (item.blob) {
        const path = `${productId}/${crypto.randomUUID()}.${extensionFor(item.blob)}`
        const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, item.blob, { contentType: item.blob.type })
        if (uploadError) throw uploadError
        const row = await q<{ id: string }>(
          supabase.from('product_images').insert({ product_id: productId, path, sort_order: i }).select('id').single(),
        )
        current[i] = { key: item.key, id: row.id, path, url: item.url }
        saved.current.photos.push({ id: row.id, product_id: productId, path, sort_order: i })
        setPhotos([...current])
      } else if (item.id) {
        const before = saved.current.photos.find((p) => p.id === item.id)
        if (before && before.sort_order !== i) {
          await q(supabase.from('product_images').update({ sort_order: i }).eq('id', item.id))
          before.sort_order = i
        }
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Product name">
        <input required autoFocus className={fieldClass} value={d.name} onChange={(e) => set('name', e.target.value)} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <select className={fieldClass} value={d.category_id} onChange={(e) => set('category_id', e.target.value)}>
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Usual supplier">
          <select className={fieldClass} value={d.supplier_id} onChange={(e) => set('supplier_id', e.target.value)}>
            <option value="">None</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unit" hint="How you count it: bag, carton, kg…">
          <input required list="unit-options" className={fieldClass} value={d.unit} onChange={(e) => set('unit', e.target.value)} />
          <datalist id="unit-options">
            {UNITS.map((u) => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </Field>
        <Field label="Pack size" hint="For example 50 for a 50 kg bag.">
          <input required type="number" min="0.001" step="any" inputMode="decimal" className={fieldClass} value={d.pack_size} onChange={(e) => set('pack_size', e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Retail price (₦)">
          <input required type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={d.retail_price} onChange={(e) => set('retail_price', e.target.value)} />
        </Field>
        <Field label="Wholesale price (₦)" hint="Optional.">
          <input type="number" min="0" step="0.01" inputMode="decimal" className={fieldClass} value={d.wholesale_price} onChange={(e) => set('wholesale_price', e.target.value)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Reorder level" hint="You’ll be warned when stock falls below this.">
          <input required type="number" min="0" step="any" inputMode="decimal" className={fieldClass} value={d.reorder_level} onChange={(e) => set('reorder_level', e.target.value)} />
        </Field>
        <Field label="Code (SKU)" hint="Optional.">
          <input className={fieldClass} value={d.sku} onChange={(e) => set('sku', e.target.value)} />
        </Field>
      </div>

      <PhotoPicker items={photos} onChange={setPhotos} disabled={busy} />

      <label className="flex items-center gap-3 text-sm font-semibold">
        <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={d.is_active} onChange={(e) => set('is_active', e.target.checked)} />
        Currently sold
      </label>

      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <button type="submit" disabled={busy || !d.name.trim()} className={primaryBtn}>
          {busy ? 'Saving…' : 'Save product'}
        </button>
      </div>
    </form>
  )
}

export default function ProductsPage() {
  const { data, error, loading, reload } = useLoad(loadCatalog)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [showOff, setShowOff] = useState(false)

  const categoryName = useMemo(() => new Map(data?.categories.map((c) => [c.id, c.name])), [data])
  const coverOf = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of data?.images ?? []) if (!m.has(i.product_id)) m.set(i.product_id, imageUrl(i.path))
    return m
  }, [data])
  const supplierName = useMemo(() => new Map(data?.suppliers.map((s) => [s.id, s.name])), [data])

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data?.products ?? []).filter(
      (p) =>
        (showOff || p.is_active) &&
        (!categoryId || p.category_id === categoryId) &&
        (!term || p.name.toLowerCase().includes(term) || (p.sku ?? '').toLowerCase().includes(term)),
    )
  }, [data, search, categoryId, showOff])

  const addButton = (
    <button onClick={() => setDraft(blank)} className={primaryBtn}>
      <Plus size={18} /> Add product
    </button>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Everything you sell, in the units you really trade in.</p>
        {!!data?.products.length && addButton}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !data?.products.length ? (
        <EmptyState
          icon={<Package size={24} />}
          title="No products yet"
          text="Add your first product with its unit, pack size and price. Sales, purchases and stock all start from here."
          action={addButton}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52 flex-1 sm:max-w-xs">
              <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                className={`${fieldClass} pl-9`}
                placeholder="Search products"
                aria-label="Search products"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className={`${fieldClass} sm:w-52`} aria-label="Filter by category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">All categories</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="h-4 w-4 accent-[var(--primary)]" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} />
              Show switched-off
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Product</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Unit</th>
                  <th className="px-4 py-3 text-right font-semibold">Retail</th>
                  <th className="px-4 py-3 text-right font-semibold">Wholesale</th>
                  <th className="px-4 py-3 text-right font-semibold">Reorder at</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((p) => (
                  <tr key={p.id} className="hover:bg-highlight/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {coverOf.get(p.id) ? (
                          <img src={coverOf.get(p.id)} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover" />
                        ) : (
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-highlight text-muted">
                            <ImageOff size={18} />
                          </span>
                        )}
                        <div>
                          <div className="font-semibold">{p.name}</div>
                          <div className="text-xs text-muted">
                            {[p.sku, p.supplier_id && supplierName.get(p.supplier_id)].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{(p.category_id && categoryName.get(p.category_id)) || '—'}</td>
                    <td className="px-4 py-3">
                      {p.unit}
                      {p.pack_size !== 1 && <span className="text-muted"> × {p.pack_size}</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatNaira(p.retail_price)}</td>
                    <td className="px-4 py-3 text-right text-muted">{p.wholesale_price == null ? '—' : formatNaira(p.wholesale_price)}</td>
                    <td className="px-4 py-3 text-right text-muted">{p.reorder_level}</td>
                    <td className="px-4 py-3"><StatusPill active={p.is_active} /></td>
                    <td className="px-4 py-3 text-right">
                      <button aria-label={`Edit ${p.name}`} onClick={() => setDraft(fromProduct(p))} className="rounded-lg p-2 text-muted hover:bg-highlight hover:text-text">
                        <Pencil size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-muted">No products match.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {draft && data && (
        <Modal title={draft.id ? 'Edit product' : 'Add product'} onClose={() => setDraft(null)}>
          <ProductForm
            initial={draft}
            categories={data.categories}
            suppliers={data.suppliers}
            images={data.images.filter((i) => i.product_id === draft.id)}
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
