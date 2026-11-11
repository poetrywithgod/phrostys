import { useCallback, useState, type FormEvent } from 'react'
import { Check, Copy, KeyRound, Plus, Power, ShieldCheck, UserRound, Bike } from 'lucide-react'
import { NotDeployedError, makePassword, staffCall, type TeamMember } from '../../lib/staffApi'
import { useLoad } from '../../lib/db'
import { formatDateTime } from '../../lib/format'
import { EmptyState, ErrorNote, Field, Modal, fieldClass, ghostBtn, primaryBtn } from '../../components/ui'

const ROLE_LABEL = { owner: 'Owner', staff: 'Staff', rider: 'Rider' } as const

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1800) })}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-highlight"
    >
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? 'Copied' : label}
    </button>
  )
}

function PasswordField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Temporary password" hint="At least 8 characters. They can set their own with Forgot password on the sign-in screen.">
      <div className="flex gap-2">
        <input required minLength={8} className={`${fieldClass} font-mono`} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" onClick={() => onChange(makePassword())} className={`${ghostBtn} shrink-0`}>Generate</button>
      </div>
    </Field>
  )
}

function Credentials({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  const text = `Phrostys login\nSign in at: ${window.location.origin}\nEmail: ${email}\nTemporary password: ${password}`
  return (
    <div className="space-y-4">
      <p className="text-sm">Give them these details. The password is not shown again, but you can set a new one any time.</p>
      <pre className="whitespace-pre-wrap rounded-xl bg-highlight p-4 font-mono text-sm">{text}</pre>
      <div className="flex justify-end gap-2">
        <CopyButton text={text} label="Copy details" />
        <button onClick={onClose} className={primaryBtn}>Done</button>
      </div>
    </div>
  )
}

function AddForm({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [d, setD] = useState({ full_name: '', email: '', phone: '', role: 'staff' as 'staff' | 'rider', password: makePassword() })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [made, setMade] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await staffCall({ action: 'create', ...d })
      setMade(true)
    } catch (err) {
      setError(err instanceof NotDeployedError ? 'The staff function is not set up yet. See the note on this page.' : (err as Error).message)
      setBusy(false)
    }
  }

  if (made) return <Credentials email={d.email.trim().toLowerCase()} password={d.password} onClose={onDone} />
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Full name"><input required autoFocus className={fieldClass} value={d.full_name} onChange={(e) => setD({ ...d, full_name: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email"><input required type="email" className={fieldClass} value={d.email} onChange={(e) => setD({ ...d, email: e.target.value })} /></Field>
        <Field label="Phone (optional)"><input type="tel" className={fieldClass} value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} /></Field>
      </div>
      <Field label="Role" hint="Staff record sales, purchases and stock. Riders handle deliveries.">
        <div role="radiogroup" className="flex gap-2">
          {(['staff', 'rider'] as const).map((r) => (
            <button key={r} type="button" role="radio" aria-checked={d.role === r} onClick={() => setD({ ...d, role: r })}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold ${d.role === r ? 'border-primary bg-primary text-on-primary' : 'border-border hover:bg-highlight'}`}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
      </Field>
      <PasswordField value={d.password} onChange={(v) => setD({ ...d, password: v })} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <button disabled={busy} className={primaryBtn}>{busy ? 'Creating…' : 'Create login'}</button>
      </div>
    </form>
  )
}

function ResetForm({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [password, setPassword] = useState(makePassword())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await staffCall({ action: 'set_password', id: member.id, password })
      setDone(true)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  if (done) return <Credentials email={member.email ?? ''} password={password} onClose={onClose} />
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-muted">This replaces {member.full_name}’s password straight away.</p>
      <PasswordField value={password} onChange={setPassword} />
      {error && <ErrorNote>{error}</ErrorNote>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <button disabled={busy} className={primaryBtn}>{busy ? 'Saving…' : 'Set password'}</button>
      </div>
    </form>
  )
}

export default function StaffPage() {
  const load = useCallback(async () => {
    try {
      return (await staffCall<{ team: TeamMember[] }>({ action: 'list' })).team
    } catch (err) {
      if (err instanceof NotDeployedError) return null // function not deployed yet
      throw err
    }
  }, [])
  const { data, error, loading, reload } = useLoad(load)
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<TeamMember | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function toggle(m: TeamMember) {
    const msg = m.is_active ? `Switch off ${m.full_name}? They will be signed out and cannot sign in until you switch them back on.` : `Let ${m.full_name} sign in again?`
    if (!window.confirm(msg)) return
    setActionError(null)
    try {
      await staffCall({ action: 'set_active', id: m.id, active: !m.is_active })
      reload()
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  const add = <button onClick={() => setAdding(true)} className={`${primaryBtn} shrink-0 whitespace-nowrap`}><Plus size={18} /> Add staff</button>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">The people who can sign in to run the shop. Only you can add or change them.</p>
        {data && add}
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {actionError && <ErrorNote>{actionError}</ErrorNote>}

      {data === null && (
        <div className="rounded-2xl border border-border bg-surface p-5 text-sm">
          <h2 className="font-display text-lg font-bold">One-time setup</h2>
          <p className="mt-1 text-muted">Creating logins needs a small secure function on Supabase. Deploy it once and this page comes alive:</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5">
            <li>Open your project on supabase.com, then <b>Edge Functions</b> and <b>Deploy a new function</b>.</li>
            <li>Name it <code className="rounded bg-highlight px-1.5 py-0.5">manage-staff</code>.</li>
            <li>Paste in the files from <code className="rounded bg-highlight px-1.5 py-0.5">supabase/functions/manage-staff</code> in the repo (<code className="rounded bg-highlight px-1.5 py-0.5">index.ts</code> and <code className="rounded bg-highlight px-1.5 py-0.5">handler.ts</code>) and deploy.</li>
          </ol>
          <button onClick={reload} className={`${ghostBtn} mt-4`}>I have deployed it, check again</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : data && data.length <= 1 && !data.some((m) => m.role !== 'owner') ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.map((m) => <MemberCard key={m.id} m={m} onToggle={toggle} onReset={setResetting} />)}</ul>
          <EmptyState icon={<UserRound size={24} />} title="No staff yet" text="Add the people who record sales and stock. Each gets their own login, so you can see who did what." action={add} />
        </>
      ) : data ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.map((m) => <MemberCard key={m.id} m={m} onToggle={toggle} onReset={setResetting} />)}</ul>
      ) : null}

      {adding && (
        <Modal title="Add staff" onClose={() => setAdding(false)}>
          <AddForm onClose={() => setAdding(false)} onDone={() => { setAdding(false); reload() }} />
        </Modal>
      )}
      {resetting && (
        <Modal title={`New password for ${resetting.full_name}`} onClose={() => setResetting(null)}>
          <ResetForm member={resetting} onClose={() => setResetting(null)} />
        </Modal>
      )}
    </div>
  )
}

function MemberCard({ m, onToggle, onReset }: { m: TeamMember; onToggle: (m: TeamMember) => void; onReset: (m: TeamMember) => void }) {
  const Icon = m.role === 'owner' ? ShieldCheck : m.role === 'rider' ? Bike : UserRound
  return (
    <li className="flex flex-col rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-highlight text-primary"><Icon size={20} /></span>
          <div>
            <h3 className="font-display font-bold leading-tight">{m.full_name || 'No name'}</h3>
            <p className="text-xs text-muted">{ROLE_LABEL[m.role]}</p>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.is_active ? 'bg-highlight text-primary' : 'bg-border text-muted'}`}>
          {m.is_active ? 'Active' : 'Switched off'}
        </span>
      </div>
      <dl className="mt-3 space-y-1 text-sm text-muted">
        {m.email && <div className="break-all">{m.email}</div>}
        {m.phone && <div>{m.phone}</div>}
        <div className="text-xs">{m.last_sign_in_at ? `Last signed in ${formatDateTime(m.last_sign_in_at)}` : 'Has not signed in yet'}</div>
      </dl>
      {m.role !== 'owner' && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <button onClick={() => onReset(m)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><KeyRound size={14} /> New password</button>
          <button onClick={() => onToggle(m)} className={`inline-flex items-center gap-1.5 text-sm font-semibold hover:underline ${m.is_active ? 'text-danger' : 'text-primary'}`}>
            <Power size={14} /> {m.is_active ? 'Switch off' : 'Switch on'}
          </button>
        </div>
      )}
    </li>
  )
}
