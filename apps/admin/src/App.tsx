export default function App() {
  const toggle = () => {
    const r = document.documentElement
    const dark = r.dataset.theme
      ? r.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches
    r.dataset.theme = dark ? 'light' : 'dark'
  }

  return (
    <div className="min-h-screen bg-bg text-text">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <span className="font-display text-2xl font-bold text-primary">Phrostys</span>
        <button onClick={toggle} className="rounded-full bg-primary px-4 py-2 font-semibold text-on-primary">
          Toggle theme
        </button>
      </header>
      <main className="p-6">
        <h1 className="font-display text-4xl font-bold">Admin app</h1>
        <p className="mt-2 text-muted">Theme tokens are working if this looks right in both modes.</p>
      </main>
    </div>
  )
}
