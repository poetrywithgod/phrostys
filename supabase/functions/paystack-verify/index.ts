// Edge Function: after the customer returns from Paystack, the website asks this
// function to double-check the payment directly with Paystack. This works even
// when the webhook has not arrived yet (or cannot reach a local computer).
// Input (JSON): { order_no, email, reference }
import { cors, findOrder, json, PAYSTACK_SECRET, settle } from '../_shared/paystack.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!PAYSTACK_SECRET) return json({ error: 'payments_not_configured' }, 503)

  const input = await req.json().catch(() => null)
  const orderNo = typeof input?.order_no === 'string' ? input.order_no : ''
  const email = typeof input?.email === 'string' ? input.email : ''
  const reference = typeof input?.reference === 'string' ? input.reference : ''
  if (!orderNo || !email || !reference) return json({ error: 'invalid_request' }, 400)

  const order = await findOrder(orderNo, email)
  if (!order) return json({ error: 'order_not_found' }, 404)
  if (order.payment_status === 'paid') return json({ payment_status: 'paid' })

  // The payment must belong to THIS order, not just any paid reference.
  if (!reference.startsWith(`${order.order_no}-`)) return json({ error: 'reference_mismatch' }, 400)

  const result = await settle(reference)
  return json({ payment_status: result.ok ? 'paid' : 'unpaid', reason: result.reason ?? null })
})
