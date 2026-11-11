import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface TeamMember {
  id: string
  full_name: string
  phone: string | null
  role: 'owner' | 'staff' | 'rider'
  is_active: boolean
  email: string | null
  last_sign_in_at: string | null
  created_at: string
}

/** Thrown when the manage-staff function has not been deployed yet. */
export class NotDeployedError extends Error {}

/** Calls the manage-staff Edge Function and turns failures into plain messages. */
export async function staffCall<T = Record<string, never>>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('manage-staff', { body })
  if (!error) return data as T
  if (error instanceof FunctionsFetchError) throw new NotDeployedError()
  if (error instanceof FunctionsHttpError) {
    if (error.context.status === 404) throw new NotDeployedError()
    const payload = await error.context.json().catch(() => null)
    throw new Error(payload?.error ?? 'Something went wrong. Try again.')
  }
  throw new Error('Something went wrong. Try again.')
}

/** A temporary password that is easy to read out: no 0/O or 1/l/I mix-ups. */
export function makePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}
