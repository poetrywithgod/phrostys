import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronLeft, ImageOff, ShoppingBag } from 'lucide-react'
import { EmptyState, ErrorNote, QtyStepper, Skeleton, Stars, ghostBtn, primaryBtn } from '../components/ui'
import { fetchProduct, fetchReviews } from '../lib/api'
import { useCart } from '../lib/cart'
import { formatDate, formatNaira } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'

export default function ProductPage() {
  const { id = '' } = useParams()
  const product = useAsync(() => fetchProduct(id), `product:${id}`)
  const reviews = useAsync(() => fetchReviews(id), `reviews:${id}`)
  const cart = useCart()
  const [qty, setQty] = useState(1)
  const [active, setActive] = useState(0)
  const [justAdded, setJustAdded] = useState(false)

  if (product.loading && !product.data) {
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-24" />
        </div>
      </div>
    )
  }

  if (product.error) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorNote>We couldn’t load this product. Please refresh and try again.</ErrorNote></div>
  }

  const p = product.data
  if (!p) {
    return (
      <div className="px-4 py-16">
        <EmptyState title="Product not found" action={<Link to="/shop" className={primaryBtn}>Back to shop</Link>}>
          It may have been removed or is no longer available online.
        </EmptyState>
      </div>
    )
  }

  const inCart = cart.items.find((i) => i.id === p.id)?.qty ?? 0
  const room = Math.max(0, p.max_order - inCart) // how many more can be added
  const canAdd = p.in_stock && room > 0
  const photos = p.image_paths

  const addToCart = () => {
    cart.add({ id: p.id, name: p.name, unit: p.unit, price: p.retail_price, image: photos[0] ?? null, max: p.max_order }, qty)
    setQty(1)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2200)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-text">
        <ChevronLeft size={16} /> Back to shop
      </Link>

      <div className="mt-4 grid gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-border bg-highlight">
            {photos.length > 0 ? (
              <img src={imageUrl(photos[active] ?? photos[0])} alt={p.name} className="h-full w-full object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-muted"><ImageOff size={40} /></div>
            )}
            {!p.in_stock && (
              <span className="absolute left-4 top-4 rounded-full bg-text px-3 py-1 text-xs font-semibold text-bg">Sold out</span>
            )}
          </div>
          {photos.length > 1 && (
            <ul className="mt-3 flex gap-2 overflow-x-auto" aria-label="Product photos">
              {photos.map((path, i) => (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === active}
                    className={`block h-16 w-16 overflow-hidden rounded-xl border-2 transition ${i === active ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                  >
                    <img src={imageUrl(path)} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {p.category_name && <p className="text-xs font-medium uppercase tracking-wide text-muted">{p.category_name}</p>}
          <h1 className="font-display text-3xl font-bold leading-tight">{p.name}</h1>
          {p.review_count > 0 && p.average_rating !== null && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Stars value={p.average_rating} />
              <span>{p.average_rating.toFixed(1)} ({p.review_count} {p.review_count === 1 ? 'review' : 'reviews'})</span>
            </div>
          )}
          <p className="text-3xl font-bold">
            {formatNaira(p.retail_price)} <span className="text-base font-medium text-muted">per {p.unit}</span>
          </p>
          {p.description && <p className="whitespace-pre-line text-sm leading-relaxed text-muted">{p.description}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canAdd && <QtyStepper value={Math.min(qty, room)} max={room} onChange={setQty} />}
            <button type="button" onClick={addToCart} disabled={!canAdd} className={`${primaryBtn} flex-1 sm:flex-none`}>
              {justAdded ? <><Check size={18} /> Added</> : <><ShoppingBag size={18} /> {p.in_stock ? 'Add to cart' : 'Sold out'}</>}
            </button>
          </div>
          {p.in_stock && room === 0 && (
            <p className="text-sm font-semibold text-warning">You already have the most we can supply in your cart.</p>
          )}
          {inCart > 0 && (
            <Link to="/cart" className={`${ghostBtn} self-start`}>View cart ({inCart})</Link>
          )}
        </div>
      </div>

      <section className="mt-14" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="font-display text-2xl font-bold">Customer reviews</h2>
        {reviews.error && <div className="mt-4"><ErrorNote>We couldn’t load the reviews.</ErrorNote></div>}
        {reviews.data && reviews.data.length === 0 && (
          <p className="mt-3 text-sm text-muted">No reviews yet. Be the first once you’ve tried it.</p>
        )}
        <ul className="mt-5 grid gap-4 md:grid-cols-2">
          {reviews.data?.map((r) => (
            <li key={r.id} className="rounded-3xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <Stars value={r.rating} size={15} />
                <time className="text-xs text-muted" dateTime={r.created_at}>{formatDate(r.created_at)}</time>
              </div>
              {r.title && <h3 className="mt-2 font-semibold">{r.title}</h3>}
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.body}</p>
              <p className="mt-3 text-xs font-semibold">{r.reviewer_name}</p>
              {r.reply && (
                <div className="mt-3 rounded-2xl bg-highlight px-4 py-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reply from the shop</p>
                  <p className="mt-1 whitespace-pre-line">{r.reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
