const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

/** 1234567 -> "₦1,234,567" */
export function formatNaira(value: number | null | undefined): string {
  return naira.format(value ?? 0)
}

/** "2026-11-10T12:30:00Z" -> "10 Nov 2026" */
export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
