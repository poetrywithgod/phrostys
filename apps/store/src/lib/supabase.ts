import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** True when the two public Supabase settings are present in .env.local. */
export const isSupabaseConfigured = Boolean(url && key)

// The publishable key is safe to ship in the browser: row-level security and the
// store_* database functions decide what visitors can see.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key')

export const IMAGE_BUCKET = 'product-images'

/** Public URL of a product photo stored in the product-images bucket. */
export const imageUrl = (path: string) => supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
