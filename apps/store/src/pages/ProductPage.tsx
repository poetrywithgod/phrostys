import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, ChevronRight, ImageOff, ShoppingBag } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { EmptyState, ErrorNote, QtyStepper, Skeleton, Stars, ghostBtn, primaryBtn } from '../components/ui'
import { fetchBestSellers, fetchProduct, fetchProducts, fetchReviews, type StoreReview } from '../lib/api'
import { useCart } from '../lib/cart'
import { formatDate, formatNaira } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'

const REVIEWS_PER_PAGE = 2

function ReviewPager({ reviews }: { reviews: StoreReview[] }) {
  const [page, setPage] = useState(0)
  const pages = Math.ceil(reviews.length / REVIEWS_PER_PAGE)
  const visible = reviews.slice(page * REVIEWS_PER_PAGE, (page + 1) * REVIEWS_PER_PAGE)

  return (
    <div>
      <ul className="space-y-4">
        {visible.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display text-lg font-semibold">{r.reviewer_name}</p>
              <Stars value={r.rating} size={15} />
            </div>
            {r.title && <p className="mt-1 text-sm font-semibold">{r.title}</p>}
            <p className="mt-1 whitespace-pre-line text-sm text-muted">{r.body}</p>
            <time className="mt-2 block text-xs text-muted" dateTime={r.created_at}>{formatDate(r.created_at)}</time>
            {r.reply && (
              <div className="mt-3 rounded-xl bg-highlight px-4 py-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Reply from the shop</p>
                <p className="mt-1 whitespace-pre-line">{r.reply}</p>
              </div>
            )}
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2" role="group" aria-label="Review pages">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPage(i)}
              aria-label={`Reviews page ${i + 1}`}
              aria-current={i === page}
              className={`h-2.5 rounded-full transition-all ${i === page ? 'w-6 bg-primary' : 'w-2.5 bg-border hover:bg-muted'}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** "You may also like": same category first, otherwise the best sellers. */
function Related({ productId, categoryId }: { productId: string; categoryId: string | null }) {
  const related = useAsync(async () => {
    const pool = categoryId ? await fetchProducts({ category: categoryId, limit: 8 }) : await fetchBestSellers(8)
    return pool.filter((p) => p.id !== productId).slice(0, 4)
  }, `related:${productId}`)

  if (!related.data || related.data.length === 0) return null
  return (
    <section className="mt-14 border-t border-border pt-10" aria-labelledby="related-heading">
      <div className="flex items-end justify-between gap-4">
        <h2 id="related-heading" className="font-display text-3xl font-semibold">You may also like</h2>
        <Link to="/shop" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">Continue shopping »</Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {related.data.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  )
}

export default function ProductPage() {
  const { id = '' } = useParams()
  const product = useAsync(() => fetchProduct(id), `product:${id}`)
  const reviews = useAsync(() => fetchReviews(id), `reviews:${id}`)
  const cart = useCart()
  const [qty, setQty] = useState(1)
  const [active, setActive] = useState(0)
  const [justAdded, setJustAdded] = useState(false)

  if (product.loading) {
    return (
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-2">
        <Skeleton className="aspect-square" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-12 w-3/4" />
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
  const lines = (p.description ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

  const addToCart = () => {
    cart.add({ id: p.id, name: p.name, unit: p.unit, price: p.retail_price, image: photos[0] ?? null, max: p.max_order }, qty)
    setQty(1)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 2200)
  }

  const info: [string, string][] = [
    ...(p.category_name ? ([['Category', p.category_name]] as [string, string][]) : []),
    ['Sold per', p.unit],
    ...(p.pack_size !== 1 ? ([['Pack size', String(p.pack_size)]] as [string, string][]) : []),
    ['Availability', p.in_stock ? 'In stock' : 'Sold out'],
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-muted">
        <Link to="/" className="hover:text-text">Home</Link>
        <ChevronRight size={14} aria-hidden="true" />
        <Link to="/shop" className="hover:text-text">Shop</Link>
        {p.category_name && (
          <>
            <ChevronRight size={14} aria-hidden="true" />
            <Link to={`/shop?category=${p.category_id}`} className="hover:text-text">{p.category_name}</Link>
          </>
        )}
        <ChevronRight size={14} aria-hidden="true" />
        <span className="font-semibold text-text" aria-current="page">{p.name}</span>
      </nav>

      <div className="mt-6 grid gap-8 md:grid-cols-2 md:gap-12">
        <div>
          <div className="relative rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-highlight">
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
        </div>

        <div className="flex flex-col gap-4">
          {p.category_name && <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{p.category_name}</p>}
          <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">{p.name}</h1>
          {p.review_count > 0 && p.average_rating !== null && (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Stars value={p.average_rating} />
              <span>{p.review_count} {p.review_count === 1 ? 'Review' : 'Reviews'}</span>
            </div>
          )}
          <p className="font-display text-4xl font-semibold">
            {formatNaira(p.retail_price)} <span className="font-sans text-base font-normal text-muted">per {p.unit}</span>
          </p>

          {lines.length > 1 ? (
            <ul className="space-y-2 text-base text-muted">
              {lines.map((l, i) => (
                <li key={i} className="flex gap-3"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" /><span>{l}</span></li>
              ))}
            </ul>
          ) : (
            lines[0] && <p className="text-base leading-relaxed text-muted">{lines[0]}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canAdd && <QtyStepper value={Math.min(qty, room)} max={room} onChange={setQty} />}
            <button type="button" onClick={addToCart} disabled={!canAdd} className={`${primaryBtn} flex-1 !rounded-xl !py-3.5 uppercase tracking-wide sm:flex-none sm:px-10`}>
              {justAdded ? <><Check size={18} /> Added</> : <><ShoppingBag size={18} /> {p.in_stock ? 'Add to cart' : 'Sold out'}</>}
            </button>
          </div>
          {p.in_stock && room === 0 && (
            <p className="text-sm font-semibold text-warning">You already have the most we can supply in your cart.</p>
          )}
          {inCart > 0 && <Link to="/cart" className={`${ghostBtn} self-start`}>View cart ({inCart})</Link>}
        </div>
      </div>

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <section aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="font-display text-3xl font-semibold">Reviews on this product</h2>
          <div className="mt-5">
            {reviews.error && <ErrorNote>We couldn’t load the reviews.</ErrorNote>}
            {reviews.data && reviews.data.length === 0 && <p className="text-sm text-muted">No reviews yet.</p>}
            {reviews.data && reviews.data.length > 0 && <ReviewPager key={p.id} reviews={reviews.data} />}
          </div>
        </section>

        <section aria-labelledby="info-heading">
          <h2 id="info-heading" className="font-display text-3xl font-semibold">Additional information</h2>
          <dl className="mt-5 space-y-3 rounded-2xl border border-border bg-surface p-6">
            {info.map(([k, v]) => (
              <div key={k} className="flex gap-3 text-base">
                <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <div><dt className="inline text-muted">{k}: </dt><dd className="inline font-medium">{v}</dd></div>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <Related productId={p.id} categoryId={p.category_id} />
    </div>
  )
}
