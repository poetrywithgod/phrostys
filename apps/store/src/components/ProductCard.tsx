import { Link } from 'react-router-dom'
import { ImageOff, Plus } from 'lucide-react'
import type { StoreListProduct } from '../lib/api'
import { useCart } from '../lib/cart'
import { formatNaira } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import { Stars } from './ui'

export default function ProductCard({ product: p }: { product: StoreListProduct }) {
  const cart = useCart()
  const inCart = cart.items.find((i) => i.id === p.id)?.qty ?? 0
  const canAdd = p.in_stock && inCart < p.max_order

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-surface transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={`/product/${p.id}`} className="block" aria-label={p.name}>
        <div className="relative aspect-square overflow-hidden bg-highlight">
          {p.cover_path ? (
            <img
              src={imageUrl(p.cover_path)}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${p.in_stock ? '' : 'opacity-60 grayscale'}`}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted">
              <ImageOff size={32} />
            </div>
          )}
          {!p.in_stock && (
            <span className="absolute left-3 top-3 rounded-full bg-text px-3 py-1 text-xs font-semibold text-bg">Sold out</span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        {p.category_name && <p className="text-xs font-medium uppercase tracking-wide text-muted">{p.category_name}</p>}
        <Link to={`/product/${p.id}`} className="font-display text-xl font-semibold leading-snug hover:underline">
          {p.name}
        </Link>
        {p.review_count > 0 && p.average_rating !== null && (
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <Stars value={p.average_rating} size={14} />
            <span>({p.review_count})</span>
          </div>
        )}
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <p className="font-display text-2xl font-semibold">{formatNaira(p.retail_price)}</p>
            <p className="text-xs text-muted">per {p.unit}</p>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() =>
              cart.add({ id: p.id, name: p.name, unit: p.unit, price: p.retail_price, image: p.cover_path, max: p.max_order })
            }
            className="grid h-11 w-11 place-items-center rounded-full bg-primary text-on-primary shadow-sm transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label={p.in_stock ? `Add ${p.name} to cart` : `${p.name} is sold out`}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>
    </article>
  )
}
