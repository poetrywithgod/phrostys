const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

/** 1234567 -> "₦1,234,567" */
export function formatNaira(value: number | null | undefined): string {
  return naira.format(value ?? 0)
}

export type Period = 'today' | 'week' | 'month'

/** Start of today, this week (Monday) or this month, in the browser's local time. */
export function periodStart(period: Period, now = new Date()): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (period === 'week') {
    const sinceMonday = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - sinceMonday)
  } else if (period === 'month') {
    d.setDate(1)
  }
  return d
}

const quantity = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 3 })

/** 1250.5 -> "1,250.5" */
export const formatQty = (value: number | null | undefined) => quantity.format(value ?? 0)

/** Today's date as YYYY-MM-DD in the browser's local time (what <input type="date"> expects). */
export const todayISO = () => new Date().toLocaleDateString('en-CA')

/** "2026-11-10" -> "10 Nov 2026" */
export const formatDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** "2026-11-10T12:30:00Z" -> "10 Nov 2026, 13:30" */
export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
