import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/** True when the two public Supabase settings are present in .env.local. */
export const isSupabaseConfigured = Boolean(url && key)

// The publishable key is safe to ship in the browser: row-level security in the
// database decides what each signed-in person can see and do.
export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing-key')
