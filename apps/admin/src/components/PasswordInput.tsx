import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import FloatingInput from './FloatingInput'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'placeholder'> & { label: string }

/** A floating-label password field with a show / hide button. */
export default function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false)

  return (
    <FloatingInput
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className="rounded-lg p-2 text-muted transition-colors hover:bg-highlight hover:text-text focus-visible:outline-2 focus-visible:outline-primary"
        >
          {visible ? <EyeOff size={20} /> : <Eye size={20} />}
        </button>
      }
    />
  )
}
