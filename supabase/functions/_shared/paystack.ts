// Shared helpers for the three Paystack functions.
// Secrets you set once (see PAYSTACK_SETUP.md): PAYSTACK_SECRET_KEY, ALLOWED_ORIGINS.
// Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY automatically.
import { createClient } from 'npm:@supabase/supabase-js@2'

export const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY') ?? ''

/** Server-side client with full database access. Never expose this to the browser. */
export const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

/** Websites allowed to receive customers back after payment. */
export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5174')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export type OrderRow = {
  id: string
  order_no: string
  email: string
  total: number | string
  payment_status: string
  status: string
}

/**
 * The order for this number AND email, or null. Emails are stored lowercase, so this
 * is an exact match: never use ilike/like here, where % and _ act as wildcards and
 * would let anyone who knows an order number skip the email check.
 */
export async function findOrder(orderNo: string, email: string): Promise<OrderRow | null> {
  const { data } = await admin
    .from('orders')
    .select('id,order_no,email,total,payment_status,status')
    .eq('order_no', orderNo.trim().toUpperCase())
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  return (data as OrderRow | null) ?? null
}

/** Money is stored in naira; Paystack counts kobo. */
export const toKobo = (naira: number | string) => Math.round(Number(naira) * 100)

/**
 * Asks Paystack whether a payment really succeeded, then marks the order paid.
 * Nothing the browser says is trusted: the status, currency and amount all come
 * from Paystack and must match the order total stored in our database.
 */
export async function settle(reference: string): Promise<{ ok: boolean; order_no?: string; reason?: string }> {
  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET}` },
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.status || !body.data) return { ok: false, reason: 'verify_failed' }

  const t = body.data
  if (t.status !== 'success') return { ok: false, reason: String(t.status ?? 'not_successful') }

  const orderNo = t.metadata?.order_no
  if (typeof orderNo !== 'string') return { ok: false, reason: 'no_order_reference' }

  const { data: order } = await admin
    .from('orders')
    .select('id,order_no,total,payment_status')
    .eq('order_no', orderNo)
    .maybeSingle()
  if (!order) return { ok: false, reason: 'order_not_found' }

  if (t.currency !== 'NGN' || Number(t.amount) !== toKobo(order.total)) {
    console.error('amount mismatch', { orderNo, paid: t.amount, expected: toKobo(order.total), currency: t.currency })
    return { ok: false, order_no: orderNo, reason: 'amount_mismatch' }
  }

  if (order.payment_status !== 'paid') {
    const { error } = await admin
      .from('orders')
      .update({ payment_status: 'paid', payment_reference: reference })
      .eq('id', order.id)
    if (error) {
      console.error('could not mark order paid', error)
      return { ok: false, order_no: orderNo, reason: 'update_failed' }
    }
  }
  return { ok: true, order_no: orderNo }
}
