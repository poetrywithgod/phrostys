// Edge Function: Paystack calls this when a payment succeeds, even if the customer
// closed their browser. Deploy it WITHOUT JWT checking (Paystack has no Supabase
// login) and paste its address into Paystack, Settings, API Keys & Webhooks.
// Every call is authenticated by Paystack's signature.
import { json, PAYSTACK_SECRET, settle } from '../_shared/paystack.ts'

const encoder = new TextEncoder()

async function signature(body: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(PAYSTACK_SECRET), { name: 'HMAC', hash: 'SHA-512' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(body)))
  return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compares two hex strings without stopping at the first difference. */
function sameSignature(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  if (!PAYSTACK_SECRET) return json({ error: 'payments_not_configured' }, 503)

  const raw = await req.text()
  const given = req.headers.get('x-paystack-signature') ?? ''
  if (!sameSignature(await signature(raw), given)) return json({ error: 'bad_signature' }, 401)

  let event: { event?: string; data?: { reference?: string } }
  try {
    event = JSON.parse(raw)
  } catch {
    return json({ error: 'bad_json' }, 400)
  }

  if (event.event === 'charge.success' && event.data?.reference) {
    // Re-check with Paystack rather than trusting the webhook body alone.
    const result = await settle(event.data.reference)
    if (!result.ok) console.error('webhook could not settle', event.data.reference, result.reason)
  }
  // Always answer 200 for valid, signed events so Paystack does not keep retrying.
  return json({ received: true })
})
