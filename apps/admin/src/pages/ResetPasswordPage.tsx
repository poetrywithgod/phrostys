import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import PasswordInput from '../components/PasswordInput'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

const primaryBtn =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-bold text-on-primary shadow-lg shadow-primary/20 transition hover:brightness-110 disabled:opacity-60'

/** Landing page for the link in the password-reset email. */
export default function ResetPasswordPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError('The two passwords don’t match.')
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (updateError) {
      setError(updateError.message || 'We couldn’t save your new password. Please try again.')
      return
    }
    setDone(true)
  }

  if (!session) {
    return (
      <AuthShell>
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">This link has expired</h1>
          <p className="mt-2 text-sm text-muted">Reset links work once and only for a short time. Please request a new one.</p>
          <button onClick={() => navigate('/login', { replace: true })} className={`${primaryBtn} mt-6`}>
            Back to sign in
          </button>
        </div>
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-highlight text-primary">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="font-display text-2xl font-bold">All set!</h1>
          <p className="mt-2 text-sm text-muted">Your password has been changed.</p>
          <button onClick={() => navigate('/', { replace: true })} className={`${primaryBtn} mt-6`}>
            Continue
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted">Make it at least 8 characters.</p>
        </div>
        <PasswordInput
          label="New password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordInput
          label="Confirm new password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {busy ? 'Saving…' : 'Save new password'}
        </button>
      </form>
    </AuthShell>
  )
}
