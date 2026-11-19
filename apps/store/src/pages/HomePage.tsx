import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard, Store, Truck } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { EmptyState, ErrorNote, Skeleton, ghostBtn, primaryBtn } from '../components/ui'
import { shop } from '../config'
import { fetchCategories, fetchProducts } from '../lib/api'
import { useAsync } from '../lib/useAsync'

const perks = [
  { icon: Truck, title: 'Delivery to your door', text: 'Order online and we bring it to you.' },
  { icon: Store, title: 'Free pickup', text: 'Prefer to collect? Pick up from our shop.' },
  { icon: CreditCard, title: 'Pay your way', text: 'Card, bank transfer, Opay, Kuda, PalmPay, Moniepoint and more.' },
]

export default function HomePage() {
  const products = useAsync(() => fetchProducts({ limit: 8 }), 'home-products')
  const categories = useAsync(fetchCategories, 'home-categories')

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="auth-bg" aria-hidden="true">
          <div className="auth-blob a" />
          <div className="auth-blob b" />
          <div className="auth-blob c" />
        </div>
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <p className="inline-block rounded-full bg-highlight px-4 py-1.5 text-xs font-semibold uppercase tracking-wider">
            Welcome to {shop.name}
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-4xl font-bold leading-tight sm:text-6xl">
            {shop.tagline}
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
            Browse our range, pay securely online, and choose delivery or pickup. It takes a couple of minutes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/shop" className={primaryBtn}>
              Shop now <ArrowRight size={18} />
            </Link>
            <a href={`https://wa.me/${shop.whatsapp}`} target="_blank" rel="noreferrer" className={ghostBtn}>
              Order on WhatsApp
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4">
        <ul className="grid gap-4 sm:grid-cols-3">
          {perks.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex items-start gap-4 rounded-3xl border border-border bg-surface p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-highlight text-primary">
                <Icon size={22} />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-muted">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {categories.data && categories.data.length > 0 && (
        <section className="mx-auto mt-14 max-w-6xl px-4">
          <h2 className="font-display text-2xl font-bold">Shop by category</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {categories.data.map((c) => (
              <Link
                key={c.id}
                to={`/shop?category=${c.id}`}
                className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-highlight"
              >
                {c.name} <span className="text-muted">({c.product_count})</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto mt-14 max-w-6xl px-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-bold">Popular right now</h2>
          <Link to="/shop" className="text-sm font-semibold underline-offset-4 hover:underline">View all</Link>
        </div>
        <div className="mt-5">
          {products.error && <ErrorNote>We couldn’t load the products. Please refresh and try again.</ErrorNote>}
          {products.loading && !products.data && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
            </div>
          )}
          {products.data && products.data.length === 0 && (
            <EmptyState title="Products are on their way">
              We’re setting up the shop. Please check back very soon.
            </EmptyState>
          )}
          {products.data && products.data.length > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {products.data.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
