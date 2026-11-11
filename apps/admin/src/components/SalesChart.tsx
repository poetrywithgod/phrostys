import { useEffect, useId, useRef, useState } from 'react'
import { compactNaira, formatNaira } from '../lib/format'

export interface SeriesPoint {
  at: string // "2026-11-10T14:00" (Lagos time)
  revenue: number
  orders: number
  profit: number | null
}

const H = 260
const PAD = { top: 16, right: 24, bottom: 30, left: 52 }

/** Round a maximum up to a tidy number so the grid lines land on 1, 2, 5, 10 steps. */
function niceMax(v: number): number {
  if (v <= 0) return 100_000
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp
}

function label(at: string, unit: 'hour' | 'day', long = false): string {
  const d = new Date(at)
  if (unit === 'hour') {
    const h = d.getHours()
    const text = `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`
    return long ? `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${text}` : text
  }
  return d.toLocaleDateString('en-GB', long ? { weekday: 'short', day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short' })
}

/**
 * Sales (area) and profit (line, owner only) over time. Plain SVG, themed with
 * the app's colour variables. It always draws a full axis, even with no sales.
 */
export default function SalesChart({ points, unit }: { points: SeriesPoint[]; unit: 'hour' | 'day' }) {
  const gid = useId()
  const wrap = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(720)
  // Draw at the real pixel width so text stays a readable size on a phone.
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setW(Math.max(280, Math.round(entry.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const [hover, setHover] = useState<number | null>(null)
  const showProfit = points.some((p) => p.profit !== null)
  const peak = Math.max(0, ...points.map((p) => p.revenue), ...points.map((p) => p.profit ?? 0))
  const empty = peak === 0
  const top = niceMax(peak)
  const iw = W - PAD.left - PAD.right
  const ih = H - PAD.top - PAD.bottom
  const n = points.length
  const x = (i: number) => PAD.left + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => PAD.top + ih - (Math.max(v, 0) / top) * ih
  const line = (get: (p: SeriesPoint) => number) => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(' ')
  const area = n ? `${line((p) => p.revenue)} L${x(n - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z` : ''
  const stepEvery = Math.max(1, Math.ceil((n * (unit === 'hour' ? 44 : 62)) / iw))
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i)

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.min(n - 1, Math.max(0, Math.round(((px - PAD.left) / iw) * (n - 1)))))
  }
  const hp = hover !== null ? points[hover] : null

  return (
    <div ref={wrap} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={empty ? 'Sales chart, no sales in this period yet' : `Sales over the period, highest ${formatNaira(peak)}`}
        width={W}
        height={H}
        className="block w-full touch-pan-y select-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" strokeDasharray={t === 0 ? undefined : '3 4'} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted" fontSize="11">
              {compactNaira(t)}
            </text>
          </g>
        ))}

        {points.map((p, i) =>
          i % stepEvery === 0 ? (
            <text key={p.at} x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted" fontSize="11">
              {label(p.at, unit)}
            </text>
          ) : null,
        )}

        {n > 0 && <path d={area} fill={`url(#${gid})`} />}
        {n > 0 && <path d={line((p) => p.revenue)} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {showProfit && n > 0 && (
          <path d={line((p) => p.profit ?? 0)} fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />
        )}

        {hp && hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={y(0)} stroke="var(--muted)" strokeWidth="1" opacity="0.5" />
            <circle cx={x(hover)} cy={y(hp.revenue)} r="5" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5" />
            {showProfit && <circle cx={x(hover)} cy={y(hp.profit ?? 0)} r="4" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />}
          </g>
        )}
      </svg>

      {empty && (
        <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-sm text-muted">
          No sales yet. Your sales will draw here as soon as you record one.
        </p>
      )}

      {hp && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: `translateX(${hover > n / 2 ? '-105%' : '5%'})` }}
        >
          <div className="font-semibold">{label(hp.at, unit, true)}</div>
          <div className="mt-1 flex justify-between gap-4"><span className="text-muted">Sales</span><span className="font-bold">{formatNaira(hp.revenue)}</span></div>
          {showProfit && <div className="flex justify-between gap-4"><span className="text-muted">Profit</span><span className="font-bold">{formatNaira(hp.profit)}</span></div>}
          <div className="flex justify-between gap-4"><span className="text-muted">Orders</span><span className="font-bold">{hp.orders}</span></div>
        </div>
      )}

      <div className="mt-1 flex items-center gap-4 pl-12 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-primary" /> Sales</span>
        {showProfit && <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded border-t-2 border-dashed border-accent" /> Profit</span>}
      </div>
    </div>
  )
}
