// Edge Function: starts a Paystack payment for an existing order and returns the
// Paystack page address the customer should be sent to.
// Input (JSON): { order_no, email, method: 'card' | 'bank_transfer', callback_url }
import { admin, allowedOrigins, cors, findOrder, json, PAYSTACK_SECRET, toKobo } from '../_shared/paystack.ts'

// Card only for "Pay with Card". "Pay with Bank Transfer" also offers Paystack's
// bank and USSD options, so customers on Opay, Kuda, PalmPay, Moniepoint and other
// bank apps can pay from their phone.
const CHANNELS: Record<string, string[]> = {
  card: ['card'],
  bank_transfer: ['bank_transfer', 'bank', 'ussd'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!PAYSTACK_SECRET) return json({ error: 'payments_not_configured' }, 503)

  const input = await req.json().catch(() => null)
  const orderNo = typeof input?.order_no === 'string' ? input.order_no : ''
  const email = typeof input?.email === 'string' ? input.email : ''
  const method = typeof input?.method === 'string' ? input.method : ''
  const callbackUrl = typeof input?.callback_url === 'string' ? input.callback_url : ''
  if (!orderNo || !email || !(method in CHANNELS)) return json({ error: 'invalid_request' }, 400)

  // Only send customers back to our own website.
  let origin = ''
  try {
    origin = new URL(callbackUrl).origin
  } catch {
    return json({ error: 'invalid_callback' }, 400)
  }
  if (!allowedOrigins().includes(origin)) return json({ error: 'callback_not_allowed' }, 400)

  const order = await findOrder(orderNo, email)
  if (!order) return json({ error: 'order_not_found' }, 404)
  if (order.payment_status === 'paid') return json({ error: 'already_paid' }, 409)
  if (order.status === 'cancelled') return json({ error: 'order_cancelled' }, 409)

  // A new reference per attempt, so a customer who goes back and retries is never blocked.
  const reference = `${order.order_no}-${Date.now().toString(36)}`
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: order.email,
      amount: toKobo(order.total),
      currency: 'NGN',
      reference,
      channels: CHANNELS[method],
      callback_url: callbackUrl,
      metadata: { order_no: order.order_no },
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.status || !body.data?.authorization_url) {
    console.error('paystack initialize failed', res.status, body?.message)
    return json({ error: 'paystack_unavailable' }, 502)
  }

  await admin.from('orders').update({ payment_method: method, payment_reference: reference }).eq('id', order.id)
  return json({ authorization_url: body.data.authorization_url, reference })
})
