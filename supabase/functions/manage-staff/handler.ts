// The rules for managing staff accounts. No Deno or network code lives here,
// so it can be tested on its own; index.ts wires it to Supabase.

export type TeamRole = 'owner' | 'staff' | 'rider'

export interface TeamMember {
  id: string
  full_name: string
  phone: string | null
  role: TeamRole
  is_active: boolean
  email: string | null
  last_sign_in_at: string | null
  created_at: string
}

export interface Deps {
  /** Who is calling? Null when the token is missing or invalid. */
  userFromToken(jwt: string): Promise<{ id: string } | null>
  roleOf(id: string): Promise<{ role: string; is_active: boolean } | null>
  listTeam(): Promise<TeamMember[]>
  createUser(input: { email: string; password: string; full_name: string }): Promise<{ id: string }>
  deleteUser(id: string): Promise<void>
  updateProfile(id: string, patch: { full_name?: string; phone?: string | null; role?: TeamRole; is_active?: boolean }): Promise<void>
  setPassword(id: string, password: string): Promise<void>
  setBanned(id: string, banned: boolean): Promise<void>
}

export interface Reply {
  status: number
  body: Record<string, unknown>
}

const fail = (status: number, message: string): Reply => ({ status, body: { error: message } })
const ok = (body: Record<string, unknown> = {}): Reply => ({ status: 200, body })
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function handle(jwt: string | null, input: unknown, deps: Deps): Promise<Reply> {
  if (!jwt) return fail(401, 'Please sign in again.')
  const caller = await deps.userFromToken(jwt)
  if (!caller) return fail(401, 'Please sign in again.')
  const me = await deps.roleOf(caller.id)
  if (!me || !me.is_active || me.role !== 'owner') return fail(403, 'Only the owner can manage staff.')

  const b = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string).trim() : '')

  switch (b.action) {
    case 'list':
      return ok({ team: await deps.listTeam() })

    case 'create': {
      const email = str('email').toLowerCase()
      const full_name = str('full_name')
      const password = typeof b.password === 'string' ? b.password : ''
      const role = b.role
      const phone = str('phone') || null
      if (!full_name) return fail(400, 'Enter their full name.')
      if (!EMAIL.test(email)) return fail(400, 'Enter a valid email address.')
      if (password.length < 8) return fail(400, 'The temporary password must be at least 8 characters.')
      if (role !== 'staff' && role !== 'rider') return fail(400, 'Choose staff or rider.')

      let id: string
      try {
        ;({ id } = await deps.createUser({ email, password, full_name }))
      } catch (e) {
        const m = e instanceof Error ? e.message : ''
        return /already|registered|exists/i.test(m) ? fail(409, 'Someone already has an account with that email.') : fail(500, 'We could not create the account. Try again.')
      }
      try {
        await deps.updateProfile(id, { full_name, phone, role, is_active: true })
      } catch {
        await deps.deleteUser(id).catch(() => undefined) // never leave a half-made account behind
        return fail(500, 'We could not finish setting up the account. Nothing was created. Try again.')
      }
      return ok({ id })
    }

    case 'set_active': {
      const id = str('id')
      if (!id || typeof b.active !== 'boolean') return fail(400, 'Missing details.')
      if (id === caller.id) return fail(400, 'You cannot switch off your own account.')
      const target = await deps.roleOf(id)
      if (!target || target.role === 'owner' || target.role === 'customer') return fail(400, 'That account cannot be changed here.')
      await deps.updateProfile(id, { is_active: b.active })
      await deps.setBanned(id, !b.active) // also stops any session that is already open
      return ok()
    }

    case 'set_password': {
      const id = str('id')
      const password = typeof b.password === 'string' ? b.password : ''
      if (!id) return fail(400, 'Missing details.')
      if (password.length < 8) return fail(400, 'The new password must be at least 8 characters.')
      const target = await deps.roleOf(id)
      if (!target || target.role === 'customer') return fail(400, 'That account cannot be changed here.')
      if (target.role === 'owner' && id !== caller.id) return fail(400, 'That account cannot be changed here.')
      await deps.setPassword(id, password)
      return ok()
    }

    default:
      return fail(400, 'Unknown request.')
  }
}
