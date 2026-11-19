import { Link } from 'react-router-dom'
import { ImageOff, Trash2 } from 'lucide-react'
import { EmptyState, QtyStepper, ghostBtn, primaryBtn } from '../components/ui'
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Your cart</h1>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <ul className="space-y-3">
          {cart.items.map((i) => (
            <li key={i.id} className="flex gap-4 rounded-3xl border border-border bg-surface p-3 sm:p-4">
              <Link to={`/product/${i.id}`} className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-highlight">
                {i.image ? (
                  <img src={imageUrl(i.image)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-muted"><ImageOff size={24} /></span>
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link to={`/product/${i.id}`} className="font-display font-semibold hover:underline">{i.name}</Link>
                    <p className="text-xs text-muted">{formatNaira(i.price)} per {i.unit}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => cart.remove(i.id)}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted transition hover:bg-danger/10 hover:text-danger"
                    aria-label={`Remove ${i.name}`}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <QtyStepper size="sm" value={i.qty} max={i.max} onChange={(n) => cart.setQty(i.id, n)} />
                  <p className="font-bold">{formatNaira(i.qty * i.price)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit space-y-4 rounded-3xl border border-border bg-surface p-5 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold">Order summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Items ({cart.count})</dt><dd className="font-semibold">{formatNaira(cart.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Delivery</dt><dd className="text-muted">Chosen at checkout</dd></div>
          </dl>
          <div className="flex items-baseline justify-between border-t border-border pt-4">
            <span className="font-semibold">Subtotal</span>
            <span className="text-2xl font-bold">{formatNaira(cart.subtotal)}</span>
          </div>
          {/* Checkout, accounts and payment arrive in the next step. */}
          <button type="button" disabled className={`${primaryBtn} w-full`} title="Checkout opens in the next update">
            Checkout coming soon
          </button>
          <Link to="/shop" className={`${ghostBtn} w-full`}>Keep shopping</Link>
        </aside>
      </div>
    </div>
  )
}
