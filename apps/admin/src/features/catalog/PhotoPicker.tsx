import { useRef, useState } from 'react'
import { ImagePlus, Star, X } from 'lucide-react'
import { MAX_PHOTOS, compressImage } from '../../lib/images'

/** One photo in the picker: either already saved (has id + path) or newly chosen (has blob). */
export interface PhotoItem {
  key: string
  url: string
  id?: string
  path?: string
  blob?: Blob
}

export default function PhotoPicker({
  items, onChange, disabled,
}: {
  items: PhotoItem[]
  onChange: (items: PhotoItem[]) => void
  disabled?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [preparing, setPreparing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    setMessage(null)
    setPreparing(true)
    const next = [...items]
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) {
        setMessage(`You can add up to ${MAX_PHOTOS} photos per product.`)
        break
      }
      try {
        const blob = await compressImage(file)
        next.push({ key: crypto.randomUUID(), url: URL.createObjectURL(blob), blob })
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'We couldn’t use that picture.')
      }
    }
    onChange(next)
    setPreparing(false)
    if (input.current) input.current.value = ''
  }

  function remove(key: string) {
    const gone = items.find((i) => i.key === key)
    if (gone?.blob) URL.revokeObjectURL(gone.url)
    onChange(items.filter((i) => i.key !== key))
  }

  function makeCover(key: string) {
    const picked = items.find((i) => i.key === key)
    if (picked) onChange([picked, ...items.filter((i) => i.key !== key)])
  }

  return (
    <div>
      <div className="mb-1 text-sm font-semibold">Photos</div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {items.map((item, index) => (
          <li key={item.key} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-bg">
            <img src={item.url} alt={`Product photo ${index + 1}`} className="h-full w-full object-cover" />
            {index === 0 && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
                Cover
              </span>
            )}
            <button
              type="button"
              aria-label="Remove photo"
              disabled={disabled}
              onClick={() => remove(item.key)}
              className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-danger"
            >
              <X size={14} />
            </button>
            {index > 0 && (
              <button
                type="button"
                aria-label="Make this the cover photo"
                disabled={disabled}
                onClick={() => makeCover(item.key)}
                className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary hover:text-on-primary"
              >
                <Star size={11} /> Cover
              </button>
            )}
          </li>
        ))}
        {items.length < MAX_PHOTOS && (
          <li>
            <button
              type="button"
              disabled={disabled || preparing}
              onClick={() => input.current?.click()}
              className="grid aspect-square w-full place-items-center rounded-xl border border-dashed border-border text-muted transition hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <span className="flex flex-col items-center gap-1 text-xs font-semibold">
                <ImagePlus size={22} />
                {preparing ? 'Preparing…' : 'Add photo'}
              </span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        data-testid="photo-input"
        onChange={(e) => onFiles(e.target.files)}
      />
      <p className="mt-1 text-xs text-muted">Up to {MAX_PHOTOS}. The first one is the cover. Photos are shrunk automatically.</p>
      {message && <p className="mt-1 text-xs font-semibold text-danger">{message}</p>}
    </div>
  )
}
