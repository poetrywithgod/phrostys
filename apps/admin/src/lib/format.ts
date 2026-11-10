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
