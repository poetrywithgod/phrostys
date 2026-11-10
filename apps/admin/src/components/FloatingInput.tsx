import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string
  /** Something to show inside the right edge of the field, e.g. a show/hide button. */
  trailing?: ReactNode
}

/**
 * A text field whose label sits inside it and floats up when you focus the
 * field or type something. The trick: the input has a single-space placeholder,
 * so CSS can tell "empty" (placeholder shown) from "filled" without any state.
 */
export default function FloatingInput({ label, trailing, id, className = '', ...rest }: Props) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <div className="relative">
      <input
        id={inputId}
        placeholder=" "
        {...rest}
        className={[
          'peer block w-full rounded-xl border border-glass-field-border bg-glass-field px-4 pb-2 pt-6 text-base text-text',
          'outline-none backdrop-blur-sm transition focus:border-primary focus:ring-2 focus:ring-primary/30',
          trailing ? 'pr-12' : '',
          className,
        ].join(' ')}
      />
      <label
        htmlFor={inputId}
        className={[
          'pointer-events-none absolute left-4 top-1/2 origin-left -translate-y-1/2 text-base text-muted transition-all duration-200',
          'peer-focus:top-3 peer-focus:translate-y-0 peer-focus:scale-75 peer-focus:font-semibold peer-focus:text-primary',
          'peer-not-placeholder-shown:top-3 peer-not-placeholder-shown:translate-y-0 peer-not-placeholder-shown:scale-75',
          'peer-autofill:top-3 peer-autofill:translate-y-0 peer-autofill:scale-75',
        ].join(' ')}
      >
        {label}
      </label>
      {trailing && <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div>}
    </div>
  )
}
