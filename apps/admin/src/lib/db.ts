import { useCallback, useEffect, useState } from 'react'

interface DbResult<T> {
  data: T | null
  error: { message: string; code?: string } | null
}

/** Turns a Supabase query into a plain promise that throws on error. */
export async function q<T>(query: PromiseLike<DbResult<T>>): Promise<T> {
  const { data, error } = await query
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
  return data as T
}

/** A to-one link can arrive as an object or, from an untyped client, a one-item list. */
export const one = <T,>(x: T | T[] | null | undefined): T | null => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null))

/** A short, human message for a failed save. */
export function explain(err: unknown, what = 'item'): string {
  const code = (err as { code?: string } | null)?.code
  if (code === '23505') return `Another ${what} with these details already exists.`
  if (code === '23503') return `This ${what} is already used by other records, so it can’t be removed. Switch it off instead.`
  if (code === '42501') return 'You don’t have permission to do that.'
  if (code === 'P0001') {
    const message = (err as Error).message
    if (message.startsWith('Not enough stock')) return 'There isn’t enough stock for that. Check the quantity.'
    return message
  }
  if (code === '23514') return 'One of the numbers is not allowed (check for negative values).'
  return 'Something went wrong. Check your connection and try again.'
}

/**
 * Loads data once and again whenever reload() is called. Pass a loader that
 * lives outside the component (so its identity never changes).
 */
export function useLoad<T>(load: () => PromiseLike<T>) {
  const [state, setState] = useState<{ data?: T; error?: string }>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    Promise.resolve(load()).then(
      (data) => !cancelled && setState({ data }),
      () => !cancelled && setState((s) => ({ ...s, error: 'We couldn’t load this. Check your connection.' })),
    )
    return () => {
      cancelled = true
    }
  }, [load, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data: state.data, error: state.error, loading: state.data === undefined && !state.error, reload }
}
