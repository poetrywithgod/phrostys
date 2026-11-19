import { useEffect, useState } from 'react'

export type AsyncState<T> = {
  /** Result for the current `key`, or null while it is loading or failed. */
  data: T | null
  /** The last successful result for any key; lets a list stay on screen while the next one loads. */
  previous: T | null
  loading: boolean
  error: string | null
}

type Settled<T> = { key: string; data: T | null; error: string | null }

/**
 * Runs `load` whenever `key` changes and tracks loading and error state.
 * A stale response (the visitor already moved on) is ignored.
 */
export function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null)
  const [previous, setPrevious] = useState<T | null>(null)

  useEffect(() => {
    let cancelled = false
    load().then(
      (data) => {
        if (cancelled) return
        setSettled({ key, data, error: null })
        setPrevious(data)
      },
      (e: unknown) => {
        if (!cancelled) setSettled({ key, data: null, error: e instanceof Error ? e.message : 'Something went wrong.' })
      },
    )
    return () => {
      cancelled = true
    }
    // `load` is recreated on every render; `key` is what actually identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const current = settled?.key === key ? settled : null
  return { data: current?.data ?? null, previous, loading: current === null, error: current?.error ?? null }
}
