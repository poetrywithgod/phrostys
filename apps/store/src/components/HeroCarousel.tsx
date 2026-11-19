import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { formatNaira } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import Logo from './Logo'

export type Slide = { id: string; name: string; price: number; unit: string; image: string }

const INTERVAL_MS = 5000
const SWIPE_PX = 40

const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Hero photo carousel: up to 5 slides, automatic every 5 seconds, with arrows,
 * thumbnails and swipe. It pauses while the visitor hovers or focuses it, and
 * does not auto-advance for people who prefer reduced motion.
 */
export default function HeroCarousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [reduced] = useState(prefersReducedMotion)
  const startX = useRef<number | null>(null)

  const count = slides.length
  const current = count ? index % count : 0
  const go = (n: number) => setIndex((n + count) % count)

  useEffect(() => {
    if (count < 2 || paused || reduced) return
    const t = setInterval(() => setIndex((i) => (i + 1) % count), INTERVAL_MS)
    return () => clearInterval(t)
  }, [count, paused, reduced, index])

  if (count === 0) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-[2rem] border border-white/15 bg-white/5">
        <Logo className="w-2/3 text-sidebar-logo" />
      </div>
    )
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured products"
      className="space-y-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(current - 1)
        if (e.key === 'ArrowRight') go(current + 1)
      }}
    >
      <div
        className="relative overflow-hidden rounded-[2rem] border border-white/20 bg-white shadow-2xl"
        style={{ touchAction: 'pan-y' }}
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current === null) return
          const dx = e.clientX - startX.current
          startX.current = null
          if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? current + 1 : current - 1)
        }}
        onPointerCancel={() => (startX.current = null)}
      >
        <div
          className="flex transition-transform duration-700 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((s, i) => (
            <div
              key={s.id}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} of ${count}`}
              aria-hidden={i !== current}
              className="relative aspect-[4/3] w-full shrink-0"
            >
              <img
                src={imageUrl(s.image)}
                alt={s.name}
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
                className="h-full w-full object-cover"
              />
              <Link
                to={`/product/${s.id}`}
                tabIndex={i === current ? 0 : -1}
                className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-2xl bg-black/55 px-4 py-3 text-white backdrop-blur-md transition hover:bg-black/70"
              >
                <span className="min-w-0 truncate font-display text-sm font-semibold sm:text-base">{s.name}</span>
                <span className="shrink-0 text-sm font-bold">{formatNaira(s.price)}</span>
              </Link>
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(current - 1)}
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => go(current + 1)}
              aria-label="Next photo"
              className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="flex justify-center gap-2" aria-label="Choose a photo">
          {slides.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-label={`Show photo ${i + 1}: ${s.name}`}
                aria-current={i === current}
                className={`block h-12 w-12 overflow-hidden rounded-xl border-2 transition sm:h-14 sm:w-14 ${
                  i === current ? 'border-sidebar-active' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={imageUrl(s.image)} alt="" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
