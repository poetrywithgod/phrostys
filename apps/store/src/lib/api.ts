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
