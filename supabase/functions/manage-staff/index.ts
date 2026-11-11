// Edge Function: lets the owner create and manage staff and rider logins.
// Creating a login needs Supabase's admin key, which must never reach the
// browser, so it happens here. Supabase supplies SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY to every function automatically; you add nothing.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { handle, type Deps, type TeamMember } from './handler.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const deps: Deps = {
  async userFromToken(jwt) {
    const { data, error } = await admin.auth.getUser(jwt)
    return error || !data.user ? null : { id: data.user.id }
  },
  async roleOf(id) {
    const { data } = await admin.from('profiles').select('role,is_active').eq('id', id).maybeSingle()
    return data
  },
  async listTeam() {
    const { data: profiles, error } = await admin
      .from('profiles')
      .select('id,full_name,phone,role,is_active,created_at')
      .in('role', ['owner', 'staff', 'rider'])
      .order('created_at')
    if (error) throw error
    const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (usersError) throw usersError
    const byId = new Map(users.users.map((u) => [u.id, u]))
    return profiles.map((p): TeamMember => ({
      ...p,
      email: byId.get(p.id)?.email ?? null,
      last_sign_in_at: byId.get(p.id)?.last_sign_in_at ?? null,
    }))
  },
  async createUser({ email, password, full_name }) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })
    if (error || !data.user) throw new Error(error?.message ?? 'create failed')
    return { id: data.user.id }
  },
  async deleteUser(id) {
    await admin.auth.admin.deleteUser(id)
  },
  async updateProfile(id, patch) {
    const { error } = await admin.from('profiles').update(patch).eq('id', id)
    if (error) throw error
  },
  async setPassword(id, password) {
    const { error } = await admin.auth.admin.updateUserById(id, { password })
    if (error) throw error
  },
  async setBanned(id, banned) {
    const { error } = await admin.auth.admin.updateUserById(id, { ban_duration: banned ? '876000h' : 'none' })
    if (error) throw error
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Use POST.' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } })
  let input: unknown = null
  try {
    input = await req.json()
  } catch {
    /* handled as an unknown request */
  }
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '') || null
  try {
    const reply = await handle(jwt, input, deps)
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Something went wrong. Try again.' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
