import { createContext, useContext } from 'react'
import type { Fulfilment } from './api'

export type CheckoutForm = {
  fulfilment: Fulfilment
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  state: string
  city: string
  deliveryLocation: string
  note: string
}

export const emptyForm: CheckoutForm = {
  fulfilment: 'delivery',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  state: '',
  city: '',
  deliveryLocation: '',
  note: '',
}

export type CheckoutValue = {
  form: CheckoutForm
  update: (patch: Partial<CheckoutForm>) => void
  reset: () => void
}

export const FORM_KEY = 'phrostys-checkout'
export const CheckoutCtx = createContext<CheckoutValue | null>(null)

export function useCheckout(): CheckoutValue {
  const ctx = useContext(CheckoutCtx)
  if (!ctx) throw new Error('useCheckout must be used inside <CheckoutProvider>')
  return ctx
}

export function loadForm(): CheckoutForm {
  try {
    const raw = sessionStorage.getItem(FORM_KEY)
    return raw ? { ...emptyForm, ...(JSON.parse(raw) as Partial<CheckoutForm>) } : emptyForm
  } catch {
    return emptyForm
  }
}

// ---- Small session records that survive the trip to Paystack and back ----

const PENDING = 'phrostys-pending-order'
const LAST = 'phrostys-last-order'

export type OrderRef = { order_no: string; email: string }
type Pending = OrderRef & { signature: string }

const read = <T,>(key: string): T | null => {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
const write = (key: string, value: unknown) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/** An unpaid order already created for exactly this cart and these details, if any. */
export const getPendingOrder = (signature: string): OrderRef | null => {
  const p = read<Pending>(PENDING)
  return p && p.signature === signature ? { order_no: p.order_no, email: p.email } : null
}
export const setPendingOrder = (signature: string, ref: OrderRef) => write(PENDING, { ...ref, signature })
export const clearPendingOrder = () => {
  try {
    sessionStorage.removeItem(PENDING)
  } catch {
    /* ignore */
  }
}
export const getLastOrder = () => read<OrderRef>(LAST)
export const setLastOrder = (ref: OrderRef) => write(LAST, ref)
