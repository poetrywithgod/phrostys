import type { Fulfilment, StoreSettings } from './api'
import { formatNaira } from './format'

/** True when the city is one of the shop's local delivery cities (case-insensitive). */
export const isLocalCity = (s: StoreSettings, city: string) =>
  s.local_cities.some((c) => c.trim().toLowerCase() === city.trim().toLowerCase())

/**
 * The delivery fee shown while the customer fills in the form. The database makes
 * the real decision when the order is placed, using the same rules.
 * Returns null until a delivery city is known.
 */
export function previewDeliveryFee(s: StoreSettings, fulfilment: Fulfilment, subtotal: number, city: string): number | null {
  if (fulfilment === 'pickup') return 0
  if (!city.trim()) return null
  if (isLocalCity(s, city)) {
    return s.free_delivery_threshold !== null && subtotal >= s.free_delivery_threshold ? 0 : s.local_delivery_fee
  }
  return s.outside_delivery_fee
}

/** Pay on delivery: allowed for pickup, or delivery inside a local city. */
export const canPayOnDelivery = (s: StoreSettings, fulfilment: Fulfilment, city: string) =>
  s.pay_on_delivery_enabled && (fulfilment === 'pickup' || (city.trim() !== '' && isLocalCity(s, city)))

/** What the delivery line should say while the fee may still be unknown. */
export function shippingText(fee: number | null, pickup: boolean): string {
  if (pickup) return 'Pickup (free)'
  if (fee === null) return 'Enter your city'
  return fee === 0 ? 'Free' : formatNaira(fee)
}
