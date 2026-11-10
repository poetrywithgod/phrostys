import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'

export type AppRole = 'owner' | 'staff' | 'rider' | 'customer'

export interface Profile {
  id: string
  full_name: string
  role: AppRole
  is_active: boolean
}

export interface AuthState {
  /** True until we know whether someone is signed in, and who they are. */
  loading: boolean
  session: Session | null
  profile: Profile | null
  /** Signed in AND an active owner or staff member. */
  hasAccess: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)
