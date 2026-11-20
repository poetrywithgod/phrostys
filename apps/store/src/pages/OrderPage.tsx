import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, ClipboardList, Home, MapPin, MessageCircle, Package, Truck, type LucideIcon } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import Stepper from '../components/Stepper'
import { ErrorNote, Field, Skeleton, fieldClass, ghostBtn, primaryBtn } from '../components/ui'
import { shop } from '../config'
import { confirmPayment, fetchBestSellers, fetchOrder, OrderError, startPayment, type TrackedOrder } from '../lib/api'
import { useCart } from '../lib/cart'
import { clearPendingOrder, getLastOrder, setLastOrder, useCheckout, type OrderRef } from '../lib/checkoutStore'
import { formatDate, formatNaira } from '../lib/format'
import { imageUrl } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'

const POLL_MS = 4000
const POLL_MAX = 10

const stageIcons: LucideIcon[] = [Check, Package, Truck, Home]

/** Asks for an order number and the email on it. */
function LookupForm({ initialNo, notFound }: { initialNo: string; notFound: boolean }) {
  const navigate = useNavigate()
  const [no, setNo] = useState(initialNo)
  const [email, setEmail] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const ref: OrderRef = { order_no: no.trim().toUpperCase(), email: email.trim().toLowerCase() }
    setLastOrder(ref)
    // Same page, new details: a full navigation makes the page start over with them.
    navigate(`/order/${ref.order_no}`, { replace: false, state: { lookup: Date.now() } })
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-8 max-w-md space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
      {notFound && <ErrorNote>We couldn’t find an order with those details. Check the order number and the email you used.</ErrorNote>}
      <Field id="orderNo" label="Order number" required>
        <input id="orderNo" required value={no} onChange={(e) => setNo(e.target.value)} placeholder="PHR-001001" className={fieldClass} autoCapitalize="characters" />
      </Field>
      <Field id="orderEmail" label="Email used for the order" required>
        <input id="orderEmail" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@gmail.com" className={fieldClass} autoComplete="email" />
      </Field>
      <button type="submit" className={`${primaryBtn} w-full`}>Find my order</button>
    </form>
  )
}

function Timeline({ order }: { order: TrackedOrder }) {
  const pickup = order.fulfilment === 'pickup'
  const labels = ['Order placed', 'Preparing', pickup ? 'Ready for pickup' : 'Shipped', pickup ? 'Collected' : 'Delivered']
  const times = [order.created_at, order.preparing_at, order.shipped_at, order.delivered_at]
  const reached = times.reduce((last, t, i) => (t ? i : last), 0)

  return (
    <section aria-labelledby="status-heading" className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
      <h2 id="status-heading" className="font-display text-2xl font-semibold">{pickup ? 'Pickup status' : 'Delivery status'}</h2>
      <ol className="mt-8 grid grid-cols-4 gap-2">
        {labels.map((label, i) => {
          const Icon = stageIcons[i]
          const done = i <= reached
          return (
            <li key={label} className="relative flex flex-col items-center gap-2 text-center" aria-current={i === reached ? 'step' : undefined}>
              {i > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-5 h-0.5 w-full -translate-y-1/2 ${done ? 'bg-primary' : 'bg-border'}`} />}
              <span className={`relative z-10 grid h-10 w-10 place-items-center rounded-full border-2 ${done ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface text-muted'}`}>
                <Icon size={18} />
              </span>
              <span className={`text-xs sm:text-sm ${done ? 'font-semibold' : 'text-muted'}`}>{label}</span>
              <span className="text-[11px] text-muted sm:text-xs">{times[i] ? formatDate(times[i]!) : 'Pending'}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

export default function OrderPage() {
  const { orderNo = '' } = useParams()
  const [params] = useSearchParams()
  const location = useLocation()
  const { clear } = useCart()
  const checkout = useCheckout()
  const reference = params.get('reference') ?? params.get('trxref')
  const justPlaced = (location.state as { placed?: boolean } | null)?.placed === true

  // The email for this order, remembered from checkout or typed into the lookup form.
  const stored = getLastOrder()
  const session: OrderRef | null =
    stored && orderNo && stored.order_no.toUpperCase() === orderNo.toUpperCase() ? stored : null

  const [state, setState] = useState<{ order: TrackedOrder | null; done: boolean; error: boolean }>({ order: null, done: false, error: false })
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let tries = 0
    const run = async (verify: boolean) => {
      try {
        if (verify && reference) await confirmPayment({ ...session, reference }).catch(() => null)
        const order = await fetchOrder(session.order_no, session.email)
        if (cancelled) return
        setState({ order, done: true, error: false })
        const waiting = order && order.payment_method !== 'pay_on_delivery' && order.payment_status === 'unpaid' && order.status !== 'cancelled'
        if (waiting && reference && tries++ < POLL_MAX) timer = setTimeout(() => run(true), POLL_MS)
      } catch {
        if (!cancelled) setState({ order: null, done: true, error: true })
      }
    }
    run(true)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // Re-run only when the order or the payment reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.order_no, session?.email, reference])

  const order = state.order
  const confirmed = !!order && order.status !== 'cancelled' && (order.payment_status === 'paid' || order.payment_method === 'pay_on_delivery')

  // Clear the cart only right after buying (back from Paystack, or just placed), never when
  // someone simply reopens an old order link while shopping for something new.
  useEffect(() => {
    if (confirmed && (reference || justPlaced)) {
      clear()
      clearPendingOrder()
      checkout.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmed])

  const recommended = useAsync(() => fetchBestSellers(3), 'order-recommended')

  const payNow = async () => {
    if (!session || !order || order.payment_method === 'pay_on_delivery') return
    setPaying(true)
    setPayError(null)
    try {
      const { authorization_url } = await startPayment({ ...session, method: order.payment_method })
      window.location.assign(authorization_url)
    } catch (e) {
      setPayError(e instanceof OrderError ? e.message : 'Something went wrong. Please try again.')
      setPaying(false)
    }
  }

  // ---- No order number, or we don't have the email for it yet: ask for both ----
  if (!orderNo || !session) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h1 className="font-display text-4xl font-semibold">Track your order</h1>
        <p className="mt-2 text-sm text-muted">Enter your order number and the email you used at checkout.</p>
        <LookupForm initialNo={orderNo} notFound={false} />
      </div>
    )
  }

  if (!state.done) {
    return <div className="mx-auto max-w-4xl space-y-4 px-4 py-10"><Skeleton className="h-16" /><Skeleton className="h-64" /></div>
  }

  if (state.error) {
    return <div className="mx-auto max-w-3xl px-4 py-10"><ErrorNote>We couldn’t load your order. Please refresh the page.</ErrorNote></div>
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <h1 className="font-display text-4xl font-semibold">Track your order</h1>
        <LookupForm initialNo={orderNo} notFound />
      </div>
    )
  }

  const pod = order.payment_method === 'pay_on_delivery'
  const waitingForPayment = !confirmed && order.status !== 'cancelled'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Stepper current={confirmed ? 3 : 2} />

      <header className="mt-8 text-center">
        <span className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-on-primary shadow-lg ${confirmed ? 'bg-primary' : 'bg-muted'}`}>
          <Check size={30} />
        </span>
        <h1 className="mt-5 font-display text-5xl font-semibold">
          {order.status === 'cancelled' ? 'Order cancelled' : confirmed ? 'Order confirmed' : 'Payment pending'}
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-muted" role="status">
          {order.status === 'cancelled' && 'This order was cancelled. Contact us if you think this is a mistake.'}
          {confirmed && !pod && `Thank you for your purchase, ${order.first_name}. We’ve received your payment and we’re getting your order ready.`}
          {confirmed && pod && `Thank you, ${order.first_name}. Your order is in. You’ll pay when you ${order.fulfilment === 'pickup' ? 'collect' : 'receive'} it.`}
          {waitingForPayment && (reference ? 'We’re confirming your payment with Paystack. This usually takes a few seconds.' : 'We haven’t received payment for this order yet.')}
        </p>
        {waitingForPayment && (
          <div className="mt-5">
            {payError && <div className="mx-auto mb-3 max-w-md"><ErrorNote>{payError}</ErrorNote></div>}
            <button type="button" onClick={payNow} disabled={paying} className={`${primaryBtn} !rounded-xl px-8`}>
              {paying ? 'Please wait…' : `Pay ${formatNaira(order.total)} now`}
            </button>
          </div>
        )}
      </header>

      {order.status !== 'cancelled' && confirmed && <div className="mt-8"><Timeline order={order} /></div>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section id="order-details" aria-labelledby="items-heading" className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-muted">Order number</p>
              <p className="font-display text-3xl font-semibold">#{order.order_no}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">{order.payment_status === 'paid' ? 'Total paid' : pod ? 'Total to pay' : 'Total due'}</p>
              <p className="font-display text-3xl font-semibold">{formatNaira(order.total)}</p>
            </div>
          </div>
          <h2 id="items-heading" className="mt-6 border-t border-border pt-5 text-sm font-semibold text-muted">Items in this order</h2>
          <ul className="mt-3 space-y-3">
            {order.items.map((i) => (
              <li key={i.product_id} className="flex items-center gap-3 rounded-xl bg-highlight/40 p-3">
                <span className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-highlight">
                  {i.image_path && <img src={imageUrl(i.image_path)} alt="" className="h-full w-full object-cover" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold">{i.name}</p>
                  <p className="text-xs text-muted">Qty: {i.quantity} · {formatNaira(i.unit_price)} per {i.unit}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatNaira(i.line_total)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd>{formatNaira(order.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">{order.fulfilment === 'pickup' ? 'Pickup' : 'Delivery'}</dt><dd>{order.delivery_fee === 0 ? 'Free' : formatNaira(order.delivery_fee)}</dd></div>
          </dl>
        </section>

        <div className="space-y-4">
          {[
            { icon: ClipboardList, title: 'Keep your order number', body: `Your order number is ${order.order_no}. You’ll need it with your email to check this order later.` },
            { icon: MapPin, title: 'Track your order', body: 'Come back to this page any time. The steps update as your order moves.', link: { to: '/order', text: 'Track another order' } },
            { icon: MessageCircle, title: 'Need help?', body: 'Message us and we’ll sort it out.', external: { href: `https://wa.me/${shop.whatsapp}`, text: 'Chat on WhatsApp' } },
          ].map((c) => (
            <div key={c.title} className="flex gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-highlight text-primary"><c.icon size={20} /></span>
              <div>
                <h3 className="font-display text-xl font-semibold">{c.title}</h3>
                <p className="text-sm text-muted">{c.body}</p>
                {c.link && <Link to={c.link.to} className="mt-1 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">{c.link.text}</Link>}
                {c.external && <a href={c.external.href} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-primary underline-offset-4 hover:underline">{c.external.text}</a>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/shop" className={primaryBtn}>Continue shopping</Link>
        <a href="#order-details" className={ghostBtn}>View order details</a>
      </div>

      {recommended.data && recommended.data.length > 0 && (
        <section className="mt-14" aria-labelledby="rec-heading">
          <h2 id="rec-heading" className="font-display text-3xl font-semibold">Recommended for you</h2>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-3">
            {recommended.data.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  )
}
