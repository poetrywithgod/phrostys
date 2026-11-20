import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Store, Truck } from 'lucide-react'
import OrderSummary from '../components/OrderSummary'
import Stepper from '../components/Stepper'
import { ErrorNote, Field, Skeleton, fieldClass, ghostBtn, primaryBtn } from '../components/ui'
import { nigerianStates } from '../config'
import type { Fulfilment } from '../lib/api'
import { useCart } from '../lib/cart'
import { useCheckout, type CheckoutForm } from '../lib/checkoutStore'
import { previewDeliveryFee } from '../lib/delivery'
import { useSettings } from '../lib/settings'
import { validateShipping } from '../lib/validate'

const choice = (active: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
    active ? 'border-primary bg-highlight/50' : 'border-border bg-surface hover:bg-highlight/30'
  }`

export default function CheckoutPage() {
  const cart = useCart()
  const { form, update } = useCheckout()
  const { settings, loading, failed } = useSettings()
  const navigate = useNavigate()
  const [submitted, setSubmitted] = useState(false)

  if (cart.items.length === 0) return <Navigate to="/cart" replace />

  const pickupPoints = settings?.pickup_address ?? []
  const pickupOk = settings ? settings.pickup_enabled && pickupPoints.length > 0 : true
  const fulfilment: Fulfilment = pickupOk ? form.fulfilment : 'delivery'
  const current: CheckoutForm = { ...form, fulfilment }
  const errors = validateShipping(current)
  const show = (k: keyof CheckoutForm) => (submitted ? errors[k] : undefined)
  const fee = settings ? previewDeliveryFee(settings, fulfilment, cart.subtotal, form.city) : null
  const delivery = fulfilment === 'delivery'

  const bind = (k: keyof CheckoutForm) => ({
    id: k,
    value: form[k],
    onChange: (e: { target: { value: string } }) => update({ [k]: e.target.value }),
    'aria-invalid': show(k) ? true : undefined,
    'aria-describedby': show(k) ? `${k}-error` : undefined,
  })

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(errors).length > 0) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    update({ fulfilment })
    navigate('/checkout/payment')
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Stepper current={1} />
      <h1 className="mt-8 text-center font-display text-4xl font-semibold">Checkout</h1>

      {failed && <div className="mt-6"><ErrorNote>We couldn’t load the delivery settings. Please refresh the page.</ErrorNote></div>}

      <form onSubmit={submit} noValidate className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">How would you like to get your order?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={choice(fulfilment === 'delivery')}>
                <input type="radio" name="fulfilment" className="mt-1 accent-[var(--primary)]" checked={fulfilment === 'delivery'} onChange={() => update({ fulfilment: 'delivery', deliveryLocation: '' })} />
                <span><span className="flex items-center gap-2 font-semibold"><Truck size={18} /> Delivery</span><span className="text-sm text-muted">We bring it to your address</span></span>
              </label>
              {pickupOk && (
                <label className={choice(fulfilment === 'pickup')}>
                  <input type="radio" name="fulfilment" className="mt-1 accent-[var(--primary)]" checked={fulfilment === 'pickup'} onChange={() => update({ fulfilment: 'pickup', deliveryLocation: '' })} />
                  <span><span className="flex items-center gap-2 font-semibold"><Store size={18} /> Pickup</span><span className="text-sm text-muted">Collect from a pickup point, free</span></span>
                </label>
              )}
            </div>
          </fieldset>

          {fulfilment === 'pickup' && (
            <Field id="deliveryLocation" label="Pickup point" required error={show('deliveryLocation')}>
              <select {...bind('deliveryLocation')} className={fieldClass}>
                <option value="">Choose a pickup point</option>
                {pickupPoints.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="firstName" label="First name" required error={show('firstName')}>
              <input {...bind('firstName')} autoComplete="given-name" placeholder="John" className={fieldClass} />
            </Field>
            <Field id="lastName" label="Last name" required error={show('lastName')}>
              <input {...bind('lastName')} autoComplete="family-name" placeholder="Doe" className={fieldClass} />
            </Field>
          </div>

          <Field id="email" label="Email address" required error={show('email')} hint="We use this to find your order later.">
            <input {...bind('email')} type="email" inputMode="email" autoComplete="email" placeholder="example@gmail.com" className={fieldClass} />
          </Field>

          <Field id="phone" label="Phone number" required error={show('phone')}>
            <input {...bind('phone')} type="tel" inputMode="tel" autoComplete="tel" placeholder="+234…" className={fieldClass} />
          </Field>

          {delivery && (
            <>
              <Field id="address" label="Home address" required error={show('address')}>
                <input {...bind('address')} autoComplete="street-address" placeholder="123 Street name" className={fieldClass} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field id="state" label="State" required error={show('state')}>
                  <select {...bind('state')} autoComplete="address-level1" className={fieldClass}>
                    <option value="">Choose a state</option>
                    {nigerianStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field id="city" label="City" required error={show('city')}>
                  <input {...bind('city')} autoComplete="address-level2" placeholder="Port Harcourt" className={fieldClass} />
                </Field>
              </div>
              <Field id="deliveryLocation" label="Delivery location" hint="A landmark or area that helps our rider find you. Optional.">
                <input {...bind('deliveryLocation')} className={fieldClass} />
              </Field>
            </>
          )}

          <Field id="note" label="Leave a note on your order">
            <textarea {...bind('note')} rows={4} maxLength={1000} placeholder="Any special instructions…" className={fieldClass} />
          </Field>
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface p-6 shadow-sm lg:sticky lg:top-28">
          <h2 className="mb-5 font-display text-2xl font-semibold">Order summary</h2>
          {loading && !settings ? <Skeleton className="h-40" /> : <OrderSummary items={cart.items} subtotal={cart.subtotal} fee={fee} pickup={!delivery} />}
        </aside>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6 lg:col-span-1">
          <Link to="/cart" className={ghostBtn}>Back</Link>
          <button type="submit" className={`${primaryBtn} !rounded-xl px-8`}>Continue to payment</button>
        </div>
      </form>
    </div>
  )
}
