import { Link } from 'react-router-dom'
import { ImageOff, Trash2 } from 'lucide-react'
import Stepper from '../components/Stepper'
import { EmptyState, QtyStepper, ghostBtn, primaryBtn } from '../components/ui'
import { deliveryNotes } from '../config'
import { useCart } from '../lib/cart'
import { formatNaira } from '../lib/format'
import { imageUrl } from '../lib/supabase'

export default function CartPage() {
  const cart = useCart()

  if (cart.items.length === 0) {
    return (
      <div className="px-4 py-16">
        <EmptyState title="Your cart is empty" action={<Link to="/shop" className={primaryBtn}>Start shopping</Link>}>
          Add a few things and they’ll show up here.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Stepper current={0} />
      <h1 className="mt-8 text-center font-display text-4xl font-semibold">Shopping cart</h1>

      <ul className="mt-8 space-y-4">
        {cart.items.map((i) => (
          <li key={i.id} className="flex gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm sm:gap-6 sm:p-5">
            <Link to={`/product/${i.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-highlight sm:h-28 sm:w-28">
              {i.image ? (
                <img src={imageUrl(i.image)} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="grid h-full w-full place-items-center text-muted"><ImageOff size={24} /></span>
              )}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/product/${i.id}`} className="font-display text-2xl font-semibold leading-tight hover:underline">{i.name}</Link>
                  <p className="text-sm text-muted">Sold per {i.unit}</p>
                  <p className="mt-1 font-semibold">{formatNaira(i.price)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => cart.remove(i.id)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-danger transition hover:bg-danger/10"
                  aria-label={`Remove ${i.name}`}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <QtyStepper size="sm" value={i.qty} max={i.max} onChange={(n) => cart.setQty(i.id, n)} />
                <p className="text-sm text-muted">Sub total <span className="ml-1 text-base font-semibold text-text">{formatNaira(i.qty * i.price)}</span></p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ul className="mt-6 space-y-2 rounded-2xl bg-highlight/60 p-5 text-sm">
        {deliveryNotes.map((n) => (
          <li key={n} className="flex gap-3"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" /><span>{n}</span></li>
        ))}
      </ul>

      <section aria-labelledby="summary-heading" className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <h2 id="summary-heading" className="font-display text-2xl font-semibold">Order summary</h2>
        <dl className="mt-5 space-y-3">
          <div className="flex justify-between"><dt>Sub total ({cart.count} {cart.count === 1 ? 'item' : 'items'})</dt><dd className="font-semibold">{formatNaira(cart.subtotal)}</dd></div>
          <div className="flex justify-between text-sm text-muted"><dt>Delivery</dt><dd>Worked out at checkout</dd></div>
        </dl>
        <div className="mt-5 flex items-baseline justify-between border-t border-border pt-5">
          <span className="font-display text-2xl font-semibold">Total</span>
          <span className="font-display text-3xl font-semibold">{formatNaira(cart.subtotal)}</span>
        </div>
        <Link to="/checkout" className={`${primaryBtn} mt-6 w-full !rounded-xl !py-4 text-base`}>Proceed to checkout</Link>
        <Link to="/shop" className={`${ghostBtn} mt-3 w-full`}>Keep shopping</Link>
      </section>
    </div>
  )
}
