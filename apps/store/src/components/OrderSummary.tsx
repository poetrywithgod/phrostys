import { ImageOff } from 'lucide-react'
import type { CartItem } from '../lib/cart'
import { shippingText } from '../lib/delivery'
import { formatNaira } from '../lib/format'
import { imageUrl } from '../lib/supabase'

/** Items, subtotal, shipping and total. `fee` is null when delivery cost is not known yet. */
export default function OrderSummary({
  items,
  subtotal,
  fee,
  pickup,
}: {
  items: CartItem[]
  subtotal: number
  fee: number | null
  pickup: boolean
}) {
  return (
    <div>
      <ul className="space-y-4">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <span className="relative h-16 w-16 shrink-0 rounded-xl bg-highlight">
              <span className="block h-full w-full overflow-hidden rounded-xl">
                {i.image ? (
                  <img src={imageUrl(i.image)} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full w-full place-items-center text-muted"><ImageOff size={20} /></span>
                )}
              </span>
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-on-primary">
                {i.qty}
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-lg font-semibold">{i.name}</p>
              <p className="text-xs text-muted">{i.qty} × {formatNaira(i.price)} per {i.unit}</p>
            </div>
            <p className="shrink-0 text-sm font-semibold">{formatNaira(i.qty * i.price)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
        <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatNaira(subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted">Shipping</dt><dd>{shippingText(fee, pickup)}</dd></div>
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="font-display text-xl font-semibold">Total</span>
        <span className="font-display text-3xl font-semibold">{formatNaira(subtotal + (fee ?? 0))}</span>
      </div>
      {fee === null && !pickup && <p className="mt-1 text-right text-xs text-muted">plus delivery</p>}
    </div>
  )
}
