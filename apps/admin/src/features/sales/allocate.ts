import type { OpenSale } from '../../lib/types'

/** Allocates a payment to the oldest unpaid sales first. */
export function allocate(sales: OpenSale[], amount: number) {
  let left = amount
  const parts: { sale: OpenSale; pay: number }[] = []
  for (const sale of [...sales].sort((a, b) => a.sold_at.localeCompare(b.sold_at))) {
    if (left <= 0) break
    const pay = Math.min(left, Number(sale.balance))
    if (pay > 0) parts.push({ sale, pay })
    left -= pay
  }
  return parts
}
