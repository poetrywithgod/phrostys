import type { StockStatus } from './data'

const STYLE: Record<StockStatus, string> = {
  ok: 'bg-highlight text-primary',
  low: 'bg-warning/15 text-warning',
  out: 'bg-danger/10 text-danger',
}
const LABEL: Record<StockStatus, string> = { ok: 'In stock', low: 'Low', out: 'Out' }

export default function StockPill({ status }: { status: StockStatus }) {
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}>{LABEL[status]}</span>
}
