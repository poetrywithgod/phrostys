import { Check } from 'lucide-react'

const steps = ['Cart', 'Shipping', 'Payment', 'Confirmation']

/** The four-step progress bar. `current` is 0 (Cart) to 3 (Confirmation). */
export default function Stepper({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="mx-auto flex w-full max-w-3xl items-start" aria-label="Checkout progress">
      {steps.map((label, i) => {
        const done = i < current || (current === 3 && i === 3)
        const here = i === current && !done
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center gap-1.5" aria-current={here ? 'step' : undefined}>
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2 ${i <= current ? 'bg-primary' : 'bg-border'}`}
              />
            )}
            <span
              className={`relative z-10 grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-semibold transition ${
                done ? 'border-primary bg-primary text-on-primary' : here ? 'border-primary bg-bg text-primary' : 'border-border bg-bg text-muted'
              }`}
            >
              {done ? <Check size={16} /> : i + 1}
            </span>
            <span className={`text-xs ${done || here ? 'font-semibold text-primary' : 'text-muted'}`}>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
