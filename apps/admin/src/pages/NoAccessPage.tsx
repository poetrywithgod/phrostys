import Logo from '../components/Logo'
import { useAuth } from '../auth/useAuth'

/** Signed in, but not an active owner or staff member. */
export default function NoAccessPage() {
  const { signOut, profile } = useAuth()
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-text">
      <div className="w-full max-w-md text-center">
        <Logo className="mx-auto mb-8 h-20 w-auto text-primary" />
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-6">
          <h1 className="font-display text-2xl font-bold">No access yet</h1>
          <p className="text-sm text-muted">
            {profile && !profile.is_active
              ? 'This account has been switched off. Please ask the owner.'
              : 'This account has not been given access to the business admin. Please ask the owner to add you as staff.'}
          </p>
          <button onClick={signOut} className="rounded-xl bg-primary px-5 py-2.5 font-bold text-on-primary">
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
