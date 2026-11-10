import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import AuthShell from '../components/AuthShell'
import FloatingInput from '../components/FloatingInput'
import PasswordInput from '../components/PasswordInput'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/useAuth'

type Mode = 'signin' | 'forgot' | 'sent'

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const primaryBtn =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-bold text-on-primary shadow-sm transition hover:brightness-110 disabled:opacity-60'

export default function LoginPage() {
  const { session, hasAccess } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (session && hasAccess) return <Navigate to="/" replace />

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes('invalid')
          ? 'That email and password don’t match. Please try again.'
          : 'We couldn’t sign you in. Check your connection and try again.',
      )
      return
    }
    navigate(from, { replace: true })
  }

  async function onForgot(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (resetError) {
      setError(
        resetError.status === 429
          ? 'Too many requests. Please wait a few minutes and try again.'
          : 'We couldn’t send the email. Check your connection and try again.',
      )
      return
    }
    switchMode('sent')
  }

  if (mode === 'sent') {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-highlight text-primary">
            <MailCheck size={28} />
          </div>
          <h1 className="font-display text-2xl font-bold">Check your email</h1>
          <p className="mt-2 text-sm text-muted">
            If there’s an account for <span className="font-semibold text-text">{email.trim()}</span>, we’ve sent a link to
            choose a new password. It may take a minute to arrive — check spam too.
          </p>
          <button
            onClick={() => switchMode('signin')}
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
          >
            <ArrowLeft size={16} /> Back to sign in
          </button>
        </div>
      </AuthShell>
    )
  }

  if (mode === 'forgot') {
    return (
      <AuthShell>
        <form onSubmit={onForgot} className="space-y-5">
          <div>
            <h1 className="font-display text-2xl font-bold">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted">No worries. Enter your email and we’ll send you a link to set a new one.</p>
          </div>
          <FloatingInput
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy} className={primaryBtn}>
            {busy && <Loader2 size={18} className="animate-spin" />}
            {busy ? 'Sending…' : 'Send reset link'}
          </button>
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className="mx-auto flex items-center gap-2 text-sm font-semibold text-muted hover:text-text"
          >
            <ArrowLeft size={16} /> Back to sign in
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <form onSubmit={onSignIn} className="space-y-5">
        <div>
          <h1 className="font-display text-3xl font-bold">{greeting()}, Admin</h1>
          <p className="mt-1 text-sm text-muted">Welcome back. Sign in to pick up where you left off.</p>
        </div>

        <FloatingInput
          label="Email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label="Password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <div className="-mt-2 text-right">
          <button
            type="button"
            onClick={() => switchMode('forgot')}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy} className={primaryBtn}>
          {busy && <Loader2 size={18} className="animate-spin" />}
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  )
}
