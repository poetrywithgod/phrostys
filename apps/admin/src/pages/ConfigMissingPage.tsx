/** Shown instead of the app when the two Supabase settings are not in .env.local. */
export default function ConfigMissingPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 text-text">
      <div className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-surface p-6">
        <h1 className="font-display text-2xl font-bold">Supabase is not connected</h1>
        <p className="text-sm text-muted">
          Create the file <code className="rounded bg-highlight px-1.5 py-0.5">apps/admin/.env.local</code> with these two
          lines, then restart the dev server:
        </p>
        <pre className="overflow-x-auto rounded-xl bg-bg p-3 text-xs">
          {`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...`}
        </pre>
      </div>
    </div>
  )
}
