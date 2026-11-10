import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type AuthState, type Profile } from './AuthContext'

interface Loaded {
  userId: string
  profile: Profile | null
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  // 1. Who is signed in?
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // 2. What are they allowed to do? (row-level security lets everyone read their own profile)
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLoaded({ userId, profile: (data as Profile | null) ?? null })
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const value = useMemo<AuthState>(() => {
    const profile = userId && loaded?.userId === userId ? loaded.profile : null
    const profileLoading = userId !== null && loaded?.userId !== userId
    return {
      loading: !sessionReady || profileLoading,
      session,
      profile,
      hasAccess: Boolean(profile?.is_active && (profile.role === 'owner' || profile.role === 'staff')),
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }
  }, [session, sessionReady, loaded, userId])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
