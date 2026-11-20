import type { CheckoutForm } from './checkoutStore'

export type ShippingErrors = Partial<Record<keyof CheckoutForm, string>>

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** The same rules the database applies, so mistakes are caught before the customer pays. */
export function validateShipping(f: CheckoutForm): ShippingErrors {
  const e: ShippingErrors = {}
  if (!f.firstName.trim()) e.firstName = 'Enter your first name.'
  if (!f.lastName.trim()) e.lastName = 'Enter your last name.'
  if (!EMAIL.test(f.email.trim())) e.email = 'Enter a valid email address.'
  const digits = f.phone.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) e.phone = 'Enter a valid phone number, for example 0803 123 4567.'
  if (f.fulfilment === 'pickup' && !f.deliveryLocation.trim()) e.deliveryLocation = 'Choose where you will pick up your order.'
  if (f.fulfilment === 'delivery') {
    if (!f.address.trim()) e.address = 'Enter your delivery address.'
    if (!f.state.trim()) e.state = 'Choose your state.'
    if (!f.city.trim()) e.city = 'Enter your city.'
  }
  return e
}
