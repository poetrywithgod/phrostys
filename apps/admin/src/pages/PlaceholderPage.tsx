import { Hammer } from 'lucide-react'

/** A screen that exists in the menu but is built in a later step. */
export default function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-surface px-6 py-20 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-highlight text-primary">
        <Hammer size={26} />
      </div>
      <h2 className="font-display text-2xl font-bold">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Being built next</p>
    </div>
  )
}
