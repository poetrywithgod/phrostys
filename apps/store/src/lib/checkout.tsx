import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CheckoutCtx, FORM_KEY, emptyForm, loadForm, type CheckoutForm } from './checkoutStore'

/** The customer's shipping details, kept for this browser tab so Back never loses them. */
export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<CheckoutForm>(loadForm)

  useEffect(() => {
    try {
      sessionStorage.setItem(FORM_KEY, JSON.stringify(form))
    } catch {
      /* ignore blocked storage */
    }
  }, [form])

  const update = useCallback((patch: Partial<CheckoutForm>) => setForm((f) => ({ ...f, ...patch })), [])
  const reset = useCallback(() => setForm(emptyForm), [])
  const value = useMemo(() => ({ form, update, reset }), [form, update, reset])
  return <CheckoutCtx.Provider value={value}>{children}</CheckoutCtx.Provider>
}
