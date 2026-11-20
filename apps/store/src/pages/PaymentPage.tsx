import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Building2, ChevronDown, CreditCard, Mail, ShieldCheck, Truck, Zap } from 'lucide-react'
import OrderSummary from '../components/OrderSummary'
import Stepper from '../components/Stepper'
import { ErrorNote, Skeleton, ghostBtn, primaryBtn } from '../components/ui'
import { OrderError, placeOrder, startPayment, type PaymentMethod } from '../lib/api'
import { useCart } from '../lib/cart'
import { clearPendingOrder, getPendingOrder, setLastOrder, setPendingOrder, useCheckout } from '../lib/checkoutStore'
import { canPayOnDelivery, previewDeliveryFee } from '../lib/delivery'
import { useSettings } from '../lib/settings'
import { validateShipping } from '../lib/validate'

const radio = (active: boolean, disabled = false) =>
  `flex items-center gap-4 rounded-2xl border-2 p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
    disabled ? 'cursor-not-allowed border-border bg-highlight/30 opacity-60' : active ? 'cursor-pointer border-primary bg-surface' : 'cursor-pointer border-border bg-surface hover:bg-highlight/30'
  }`

const Bullet = ({ icon: Icon, children }: { icon: typeof Zap; children: string }) => (
  <li className="flex items-center gap-3 text-sm">
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-highlight text-primary"><Icon size={18} /></span>
    {children}
  </li>
)

export default function PaymentPage() {
  const cart = useCart()
  const { form } = useCheckout()
  const { settings, loading } = useSettings()
  const navigate = useNavigate()
  const [choice, setChoice] = useState<PaymentMethod>('card')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (cart.items.length === 0) return <Navigate to="/cart" replace />
  if (Object.keys(validateShipping(form)).length > 0) return <Navigate to="/checkout" replace />
  if (loading || !settings) return <div className="mx-auto max-w-3xl space-y-4 px-4 py-10"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>

  const pickup = form.fulfilment === 'pickup'
  const podOk = canPayOnDelivery(settings, form.fulfilment, form.city)
  const method: PaymentMethod = choice === 'pay_on_delivery' && !podOk ? 'card' : choice
  const fee = previewDeliveryFee(settings, form.fulfilment, cart.subtotal, form.city)
  const podNote = settings.local_cities.length > 0 ? `${settings.local_cities.join(', ')} only` : 'Not available'

  const pay = async () => {
    setBusy(true)
    setError(null)
    try {
      // The same cart and details reuse the order already created, so a retry never makes a duplicate.
      const signature = JSON.stringify({
        items: [...cart.items].sort((a, b) => a.id.localeCompare(b.id)).map((i) => [i.id, i.qty]),
        form,
      })
      let ref = method === 'pay_on_delivery' ? null : getPendingOrder(signature)
      if (!ref) {
        const placed = await placeOrder({
          items: cart.items.map((i) => ({ product_id: i.id, qty: i.qty })),
          fulfilment: form.fulfilment,
          payment_method: method,
          first_name: form.firstName.trim(),
          last_name: form.lastName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          address: form.address.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          delivery_location: form.deliveryLocation.trim(),
          note: form.note.trim(),
        })
        ref = { order_no: placed.order_no, email: placed.email }
        if (method !== 'pay_on_delivery') setPendingOrder(signature, ref)
      }
      setLastOrder(ref)

      if (method === 'pay_on_delivery') {
        cart.clear()
        clearPendingOrder()
        navigate(`/order/${ref.order_no}`, { state: { placed: true } })
        return
      }
      const { authorization_url } = await startPayment({ ...ref, method })
      window.location.assign(authorization_url) // on to Paystack; this page stays busy meanwhile
    } catch (e) {
      setError(e instanceof OrderError ? e.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Stepper current={2} />
      <h1 className="mt-8 font-display text-4xl font-semibold">Payment method</h1>

      <p className="mt-3 rounded-xl bg-highlight/60 px-4 py-3 text-sm">
        {pickup ? 'Pickup from our shop' : <>Delivering to <strong>{[form.address, form.city, form.state].filter(Boolean).join(', ')}</strong></>}
        {' '}· <Link to="/checkout" className="font-semibold underline underline-offset-4">Change</Link>
      </p>

      <fieldset className="mt-6 space-y-3">
        <legend className="sr-only">Choose how to pay</legend>

        <label className={radio(method === 'card')}>
          <input type="radio" name="method" className="accent-[var(--primary)]" checked={method === 'card'} onChange={() => setChoice('card')} />
          <span className="flex-1"><span className="flex items-center gap-2 font-display text-xl font-semibold"><CreditCard size={18} /> Pay with card</span><span className="text-sm text-muted">Debit or credit card (Visa, Verve or Mastercard)</span></span>
        </label>

        <label className={radio(method === 'bank_transfer')}>
          <input type="radio" name="method" className="accent-[var(--primary)]" checked={method === 'bank_transfer'} onChange={() => setChoice('bank_transfer')} />
          <span className="flex-1"><span className="flex items-center gap-2 font-display text-xl font-semibold"><Building2 size={18} /> Pay with bank transfer</span><span className="text-sm text-muted">Secure transfer via Paystack, from any bank or fintech app</span></span>
        </label>

        <label className={radio(method === 'pay_on_delivery', !podOk)}>
          <input type="radio" name="method" className="accent-[var(--primary)]" disabled={!podOk} checked={method === 'pay_on_delivery'} onChange={() => setChoice('pay_on_delivery')} />
          <span className="flex-1"><span className="flex items-center gap-2 font-display text-xl font-semibold"><Truck size={18} /> Pay on {pickup ? 'pickup' : 'delivery'}</span><span className="text-sm text-muted">Pay when you receive your order</span></span>
          {!podOk && <span className="rounded-full bg-highlight px-3 py-1 text-xs font-medium">{podNote}</span>}
        </label>
      </fieldset>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm" aria-live="polite">
        {method === 'card' && (
          <>
            <h2 className="font-display text-2xl font-semibold">Pay with card</h2>
            <p className="mt-2 text-sm text-muted">You’ll be taken to Paystack’s secure page to enter your card details. We never see or store your card number.</p>
            <ul className="mt-4 space-y-3">
              <Bullet icon={Zap}>Instant payment confirmation</Bullet>
              <Bullet icon={ShieldCheck}>Secure encryption for all transactions</Bullet>
            </ul>
          </>
        )}
        {method === 'bank_transfer' && (
          <>
            <h2 className="font-display text-2xl font-semibold">Paystack bank transfer</h2>
            <p className="mt-2 text-sm text-muted">You’ll be redirected to Paystack to complete your transfer securely. Opay, Kuda, PalmPay, Moniepoint and other bank apps all work.</p>
            <ul className="mt-4 space-y-3">
              <Bullet icon={Zap}>Instant payment confirmation</Bullet>
              <Bullet icon={ShieldCheck}>Secure encryption for all transactions</Bullet>
            </ul>
          </>
        )}
        {method === 'pay_on_delivery' && (
          <>
            <h2 className="font-display text-2xl font-semibold">Pay on {pickup ? 'pickup' : 'delivery'}</h2>
            <p className="mt-2 text-sm text-muted">Place your order now and pay when you {pickup ? 'collect it' : 'receive it'}. Please have the exact amount ready.</p>
            <ul className="mt-4 space-y-3"><Bullet icon={Mail}>Keep your order number to track your order</Bullet></ul>
          </>
        )}

        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}

        <button type="button" onClick={pay} disabled={busy} className={`${primaryBtn} mt-5 w-full !rounded-xl !py-4 text-base`}>
          {busy ? 'Please wait…' : method === 'pay_on_delivery' ? <>Place order <ArrowRight size={18} /></> : <>Click here to continue <ArrowRight size={18} /></>}
        </button>
      </section>

      <div className="mt-6 border-t border-border pt-6">
        <Link to="/checkout" className={ghostBtn}>Back to shipping</Link>
      </div>

      <details className="group mt-6 rounded-2xl border border-border bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 [&::-webkit-details-marker]:hidden">
          <span className="font-display text-xl font-semibold">Order summary <span className="font-sans text-sm font-normal text-muted">({cart.count} {cart.count === 1 ? 'item' : 'items'})</span></span>
          <ChevronDown size={20} className="transition group-open:rotate-180" />
        </summary>
        <div className="border-t border-border p-5"><OrderSummary items={cart.items} subtotal={cart.subtotal} fee={fee} pickup={pickup} /></div>
      </details>
    </div>
  )
}
