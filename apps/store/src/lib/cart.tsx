import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type CartItem = {
  id: string
  name: string
  unit: string
  price: number
  image: string | null // storage path of the cover photo
  qty: number
  max: number // most the visitor may order, from the shop's stock
}

type CartValue = {
  items: CartItem[]
  count: number
  subtotal: number
  add: (item: Omit<CartItem, 'qty'>, qty?: number) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  clear: () => void
}

const KEY = 'phrostys-cart'
const CartContext = createContext<CartValue | null>(null)

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as CartItem[]) : []
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.id === 'string' && i.qty > 0) : []
  } catch {
    return []
  }
}

const clamp = (qty: number, max: number) => Math.max(1, Math.min(Math.floor(qty), Math.max(1, Math.floor(max))))

/** The shopping cart. It lives in this browser only until checkout (step 2). */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* storage can be blocked; the cart still works for this visit */
    }
  }, [items])

  // Keep two open tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const add = useCallback<CartValue['add']>((item, qty = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id)
      if (existing) {
        // Refresh price and stock cap from the latest product data.
        return prev.map((i) => (i.id === item.id ? { ...i, ...item, qty: clamp(i.qty + qty, item.max) } : i))
      }
      return [...prev, { ...item, qty: clamp(qty, item.max) }]
    })
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: clamp(qty, i.max) } : i)))
  }, [])

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((i) => i.id !== id)), [])
  const clear = useCallback(() => setItems([]), [])

  const value = useMemo<CartValue>(
    () => ({
      items,
      count: items.reduce((n, i) => n + i.qty, 0),
      subtotal: items.reduce((n, i) => n + i.qty * i.price, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [items, add, setQty, remove, clear],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>')
  return ctx
}
