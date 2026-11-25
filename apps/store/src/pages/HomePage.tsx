import { Link } from 'react-router-dom'
import { ArrowRight, CreditCard, LayoutGrid, Minus, Plus, ShieldCheck, Truck, type LucideIcon } from 'lucide-react'
import HeroCarousel, { type Slide } from '../components/HeroCarousel'
import ProductCard from '../components/ProductCard'
import { ErrorNote, Skeleton, Stars, ghostBtn } from '../components/ui'
import { about, faqs, features, hero, shop } from '../config'
import { fetchBestSellers, fetchLatestReviews } from '../lib/api'
import { formatDate } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const icons: Record<(typeof features)[number]['icon'], LucideIcon> = {
  shield: ShieldCheck,
  grid: LayoutGrid,
  truck: Truck,
  wallet: CreditCard,
}

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'

export default function HomePage() {
  const best = useAsync(() => fetchBestSellers(12), 'home-best')
  const reviews = useAsync(() => fetchLatestReviews(3), 'home-reviews')

  const withPhotos = (best.data ?? []).filter((p) => p.cover_path)
  const productSlides: Slide[] = withPhotos
    .slice(0, 5)
    .map((p) => ({ id: p.id, name: p.name, price: p.retail_price, unit: p.unit, image: p.cover_path! }))
  // The company flyer is one of the sliding images. Move it within this array to change its position.
  const flyerSlide: Slide = {
    kind: 'promo',
    id: 'flyer',
    name: 'Phrostys by Frosty’s Global Enterprises: pap, tombrown cereal, fufu flour, soya milk powder, bambara flour and more',
    image: '/hero-flyer.webp',
    href: '/shop',
    label: 'Shop all products',
  }
  const slides: Slide[] = [flyerSlide, ...productSlides]

  return (
    <>
      {/* Hero */}
      <section className="bg-sidebar text-sidebar-text">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-16 lg:grid-cols-2 lg:gap-14">
          <div>
            <h1 className="font-display text-3xl font-semibold leading-tight sm:text-4xl">
              {hero.title}
              <span className="mt-1 block text-5xl font-bold italic text-sidebar-active sm:text-6xl">{hero.emphasis}</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-sidebar-muted sm:text-lg">{hero.text}</p>
            <Link
              to="/shop"
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-sidebar-active px-8 py-3.5 text-base font-semibold text-[#011207] shadow-lg transition hover:brightness-105 active:scale-[0.98]"
            >
              Order now <ArrowRight size={18} />
            </Link>
          </div>

          {best.loading && !best.data ? <Skeleton className="aspect-[4/3] !rounded-[2rem] !bg-white/10" /> : <HeroCarousel slides={slides} />}
        </div>
      </section>

      {/* Why us */}
      <section className="bg-highlight/60">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-[1fr_1.6fr]">
          <div className="hidden md:block">
            {/* 4:3 image, kept in apps/store/public. Replace the file to change it. */}
            <img
              src="/home-products.webp"
              alt="Phrostys fufu cassava flour, tombrown cereal and soya milk powder packs"
              loading="lazy"
              className="aspect-[4/3] w-full rounded-[2rem] border border-border object-cover shadow-lg"
            />
          </div>
          <ul className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {features.map((f) => {
              const Icon = icons[f.icon]
              return (
                <li key={f.title} className="text-center">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-surface text-primary shadow-sm">
                    <Icon size={24} />
                  </span>
                  <h2 className="mt-3 font-display text-lg font-semibold">{f.title}</h2>
                  <p className="mx-auto mt-1 max-w-[16rem] text-sm text-muted">{f.text}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Best sellers */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="best-heading">
        <div className="flex items-end justify-between gap-4">
          <h2 id="best-heading" className="font-display text-3xl font-bold">Best sellers</h2>
          <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-text">
            See more <ArrowRight size={16} />
          </Link>
        </div>
        <div className="mt-6">
          {best.error && <ErrorNote>We couldn’t load the products. Please refresh and try again.</ErrorNote>}
          {best.loading && !best.data && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
            </div>
          )}
          {best.data && best.data.length === 0 && (
            <p className="rounded-3xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center text-sm text-muted">
              We’re setting up the shop. Please check back very soon.
            </p>
          )}
          {best.data && best.data.length > 0 && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {best.data.slice(0, 8).map((p) => <ProductCard key={p.id} product={p} compact />)}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-20 bg-sidebar text-sidebar-text">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold">{about.title}</h2>
            <p className="mt-4 max-w-md text-base leading-relaxed text-sidebar-muted">{about.text}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {about.supplies.map((s) => (
                <li key={s} className="flex items-center gap-3"><span className="h-2 w-2 shrink-0 rounded-sm bg-sidebar-active" aria-hidden="true" />{s}</li>
              ))}
            </ul>
            <Link
              to="/shop"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-sidebar-active px-8 py-3.5 text-base font-semibold text-[#011207] transition hover:brightness-105 active:scale-[0.98]"
            >
              Shop now
            </Link>
          </div>
          {/* 4:3 image, kept in apps/store/public. Replace the file to change it. */}
          <img
            src="/home-family.webp"
            alt="A mother serving cereal to two smiling children at the kitchen table"
            loading="lazy"
            className="aspect-[4/3] w-full rounded-[2rem] border border-white/20 object-cover shadow-2xl"
          />
        </div>
      </section>

      {/* Custom orders, vision and mission */}
      <section className="mx-auto max-w-6xl px-4 py-14" aria-labelledby="custom-heading">
        <div className="rounded-3xl bg-accent px-6 py-8 text-center text-[#011207] sm:px-10">
          <h2 id="custom-heading" className="font-display text-3xl font-bold">{about.custom.title}</h2>
          <p className="mt-2 text-lg font-semibold">{about.custom.text}</p>
          <a
            href={`https://wa.me/${shop.whatsapp}?text=${encodeURIComponent('Hello, I would like to place a custom order.')}`}
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-flex items-center rounded-full bg-[#011207] px-7 py-3 text-sm font-semibold text-white transition hover:brightness-125"
          >
            Tell us what you want
          </a>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {[about.vision, about.mission].map((b) => (
            <article key={b.title} className="rounded-3xl bg-sidebar p-7 text-sidebar-text">
              <h3 className="font-display text-2xl font-bold text-sidebar-active">{b.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">{b.text}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Customer reviews: real, approved reviews only. Hidden until there are some. */}
      {reviews.data && reviews.data.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="reviews-heading">
          <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
            <div>
              <h2 id="reviews-heading" className="font-display text-3xl font-bold">What our customers say</h2>
              <p className="mt-3 max-w-xs text-sm text-muted">
                Real reviews from people who’ve shopped with us.
              </p>
            </div>
            <ul className="space-y-4">
              {reviews.data.map((r, i) => (
                <li
                  key={r.id}
                  className={`flex gap-4 rounded-3xl border border-border bg-surface p-5 ${i % 2 === 1 ? 'md:ml-10' : ''}`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-highlight font-display text-sm font-semibold text-primary" aria-hidden="true">
                    {initials(r.reviewer_name)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <p className="font-display font-semibold">{r.reviewer_name}</p>
                      <Stars value={r.rating} size={14} />
                    </div>
                    <p className="mt-1 line-clamp-4 text-sm text-muted">{r.body}</p>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                      <time dateTime={r.created_at}>{formatDate(r.created_at)}</time>
                      {r.product_id && (
                        <Link to={`/product/${r.product_id}`} className="font-semibold underline-offset-4 hover:underline">
                          View product
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16" aria-labelledby="faq-heading">
        <h2 id="faq-heading" className="font-display text-3xl font-bold">Frequently asked questions</h2>
        <div className="mt-6 divide-y divide-border border-y border-border">
          {faqs.map((f, i) => (
            <details key={f.q} className="group py-1" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-1 py-4 font-display text-base font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                <span>{i + 1}. {f.q}</span>
                <Plus size={20} className="shrink-0 group-open:hidden" />
                <Minus size={20} className="hidden shrink-0 group-open:block" />
              </summary>
              <p className="px-1 pb-4 text-sm leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col items-start justify-between gap-5 rounded-[2rem] bg-sidebar px-6 py-8 text-sidebar-text sm:flex-row sm:items-center sm:px-10">
          <div>
            <p className="text-sm text-sidebar-muted">{shop.name}</p>
            <p className="font-display text-xl font-semibold sm:text-2xl">{shop.tagline}</p>
          </div>
          <Link
            to="/shop"
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-sidebar-active px-8 py-3.5 text-base font-semibold text-[#011207] transition hover:brightness-105 active:scale-[0.98]"
          >
            Order now <ArrowRight size={18} />
          </Link>
        </div>
        <p className="mt-4 text-center">
          <a href={`https://wa.me/${shop.whatsapp}`} target="_blank" rel="noreferrer" className={`${ghostBtn} !py-2.5`}>
            Prefer to chat? Message us on WhatsApp
          </a>
        </p>
      </section>
    </>
  )
}
