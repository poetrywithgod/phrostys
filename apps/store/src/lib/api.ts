import { supabase } from './supabase'

/** A product as the public sees it. No cost, no exact stock. */
export type StoreProduct = {
  id: string
  name: string
  unit: string
  pack_size: number
  retail_price: number
  description: string | null
  category_id: string | null
  category_name: string | null
  in_stock: boolean
  /** Most the cart will allow (capped at 50). */
  max_order: number
  average_rating: number | null
  review_count: number
}

export type StoreListProduct = StoreProduct & { cover_path: string | null }
export type StoreDetailProduct = StoreProduct & { image_paths: string[] }
export type StoreCategory = { id: string; name: string; product_count: number }

export type StoreReview = {
  id: string
  reviewer_name: string
  rating: number
  title: string | null
  body: string
  reply: string | null
  created_at: string
}

// Numeric columns can arrive as strings from Postgres; normalise them once here.
function clean<T extends StoreProduct>(row: T): T {
  return {
    ...row,
    pack_size: Number(row.pack_size),
    retail_price: Number(row.retail_price),
    max_order: Number(row.max_order),
    average_rating: row.average_rating === null ? null : Number(row.average_rating),
    review_count: Number(row.review_count),
  }
}

export async function fetchCategories(): Promise<StoreCategory[]> {
  const { data, error } = await supabase.rpc('store_categories')
  if (error) throw error
  return (data ?? []).map((c: StoreCategory) => ({ ...c, product_count: Number(c.product_count) }))
}

export async function fetchProducts(opts: { category?: string | null; search?: string; limit?: number } = {}) {
  const { data, error } = await supabase.rpc('store_products', {
    p_category: opts.category ?? null,
    p_search: opts.search?.trim() || null,
    p_limit: opts.limit ?? 48,
    p_offset: 0,
  })
  if (error) throw error
  return ((data ?? []) as StoreListProduct[]).map(clean)
}

export async function fetchProduct(id: string): Promise<StoreDetailProduct | null> {
  const { data, error } = await supabase.rpc('store_product', { p_id: id })
  if (error) throw error
  const row = (data as StoreDetailProduct[] | null)?.[0]
  return row ? clean(row) : null
}

/** Approved reviews only; row-level security hides everything else from visitors. */
export async function fetchReviews(productId: string): Promise<StoreReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,reviewer_name,rating,title,body,reply,created_at')
    .eq('product_id', productId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as StoreReview[]
}

/** Best sellers of the last 90 days, ranked by the database. Same safe fields as the shop. */
export async function fetchBestSellers(limit = 8) {
  const { data, error } = await supabase.rpc('store_best_sellers', { p_limit: limit })
  if (error) throw error
  return ((data ?? []) as StoreListProduct[]).map(clean)
}

export type StoreLatestReview = StoreReview & { product_id: string | null }

/** The newest approved reviews across the whole shop. */
export async function fetchLatestReviews(limit = 3): Promise<StoreLatestReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,product_id,reviewer_name,rating,title,body,reply,created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as StoreLatestReview[]
}

// ------------------------------------------------------------------ settings

export type StoreSettings = {
  local_cities: string[]
  local_delivery_fee: number
  outside_delivery_fee: number
  free_delivery_threshold: number | null
  pickup_enabled: boolean
  pickup_address: string[]
  pay_on_delivery_enabled: boolean
}

export async function fetchSettings(): Promise<StoreSettings> {
  const { data, error } = await supabase.rpc('store_settings_public')
  if (error) throw error
  const row = (data as StoreSettings[] | null)?.[0]
  if (!row) throw new Error('Store settings are missing.')
  return {
    ...row,
    local_delivery_fee: Number(row.local_delivery_fee),
    outside_delivery_fee: Number(row.outside_delivery_fee),
    free_delivery_threshold: row.free_delivery_threshold === null ? null : Number(row.free_delivery_threshold),
  }
}

// -------------------------------------------------------------------- orders

export type PaymentMethod = 'card' | 'bank_transfer' | 'pay_on_delivery'
export type Fulfilment = 'delivery' | 'pickup'

export type OrderInput = {
  items: { product_id: string; qty: number }[]
  fulfilment: Fulfilment
  payment_method: PaymentMethod
  first_name: string
  last_name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  delivery_location: string
  note: string
}

export type PlacedOrder = {
  order_id: string
  order_no: string
  email: string
  subtotal: number
  delivery_fee: number
  total: number
  payment_method: PaymentMethod
  payment_status: string
}

/** An error with a short code (see place_order in the database) and a friendly message. */
export class OrderError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function friendly(code: string, detail?: string): string {
  switch (code) {
    case 'out_of_stock':
      return `Sorry, we don’t have enough ${detail ?? 'of that item'} in stock right now. Please lower the quantity in your cart.`
    case 'product_unavailable':
      return `${detail ?? 'An item'} is no longer available. Please remove it from your cart.`
    case 'pay_on_delivery_unavailable':
      return 'Pay on delivery isn’t available for this order. Please choose card or bank transfer.'
    case 'invalid_pickup_point':
      return 'Please choose one of our pickup points.'
    case 'pickup_unavailable':
      return 'Pickup isn’t available right now. Please choose delivery.'
    case 'invalid_order':
      return 'Some of your details look incomplete or invalid. Please go back and check them.'
    case 'empty_cart':
      return 'Your cart is empty.'
    case 'payments_not_configured':
      return 'Online payment isn’t switched on yet. Please choose pay on delivery or contact us.'
    case 'paystack_unavailable':
      return 'We couldn’t reach the payment service. Please try again in a moment.'
    case 'already_paid':
      return 'This order has already been paid for.'
    case 'order_cancelled':
      return 'This order was cancelled.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export async function placeOrder(input: OrderInput): Promise<PlacedOrder> {
  const { data, error } = await supabase.rpc('place_order', { p_order: input })
  if (error) {
    const [code, ...rest] = error.message.split(':')
    throw new OrderError(code.trim(), friendly(code.trim(), rest.join(':').trim() || undefined))
  }
  const o = data as PlacedOrder
  return { ...o, subtotal: Number(o.subtotal), delivery_fee: Number(o.delivery_fee), total: Number(o.total) }
}

/** Calls one of our Edge Functions and turns its error body into an OrderError. */
async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    let code = 'unknown'
    const res = (error as { context?: Response }).context
    if (res && typeof res.json === 'function') {
      const parsed = await res.json().catch(() => null)
      if (parsed && typeof parsed.error === 'string') code = parsed.error
    }
    throw new OrderError(code, friendly(code))
  }
  return data as T
}

/** Starts a Paystack payment and returns the page to send the customer to. */
export function startPayment(args: { order_no: string; email: string; method: 'card' | 'bank_transfer' }) {
  return callFunction<{ authorization_url: string; reference: string }>('paystack-init', {
    ...args,
    callback_url: `${window.location.origin}/order/${args.order_no}`,
  })
}

/** After returning from Paystack: asks the server to confirm the payment with Paystack. */
export function confirmPayment(args: { order_no: string; email: string; reference: string }) {
  return callFunction<{ payment_status: string }>('paystack-verify', args)
}

export type TrackedOrder = {
  order_no: string
  status: 'new' | 'preparing' | 'shipped' | 'delivered' | 'cancelled'
  payment_status: 'unpaid' | 'paid' | 'failed'
  payment_method: PaymentMethod
  fulfilment: Fulfilment
  first_name: string
  last_name: string
  address: string | null
  city: string | null
  state: string | null
  delivery_location: string | null
  subtotal: number
  delivery_fee: number
  total: number
  created_at: string
  paid_at: string | null
  preparing_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  items: { product_id: string; name: string; unit: string; unit_price: number; quantity: number; line_total: number; image_path: string | null }[]
}

/** One order, only when the order number AND email both match. */
export async function fetchOrder(orderNo: string, email: string): Promise<TrackedOrder | null> {
  const { data, error } = await supabase.rpc('track_order', { p_order_no: orderNo, p_email: email })
  if (error) throw error
  return (data as TrackedOrder | null) ?? null
}
