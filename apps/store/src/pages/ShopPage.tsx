import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import { EmptyState, ErrorNote, Skeleton, fieldClass } from '../components/ui'
import { fetchCategories, fetchProducts } from '../lib/api'
import { useAsync } from '../lib/useAsync'

const chip = (active: boolean) =>
  `shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
    active ? 'border-primary bg-primary text-on-primary' : 'border-border bg-surface hover:bg-highlight'
  }`

export default function ShopPage() {
  const [params, setParams] = useSearchParams()
  const category = params.get('category')
  const query = params.get('q') ?? ''

  // The search box types freely; the URL (and the request) update after a short pause.
  const [text, setText] = useState(query)
  const [seenQuery, setSeenQuery] = useState(query)
  if (query !== seenQuery) {
    // The address changed from outside (for example the header search): follow it,
    // unless it only echoes what is already being typed.
    setSeenQuery(query)
    if (query.trim() !== text.trim()) setText(query)
  }
  useEffect(() => {
    if (text.trim() === query.trim()) return
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (text.trim()) next.set('q', text.trim())
      else next.delete('q')
      setParams(next, { replace: true })
    }, 350)
    return () => clearTimeout(t)
  }, [text, query, params, setParams])

  const categories = useAsync(fetchCategories, 'shop-categories')
  const result = useAsync(() => fetchProducts({ category, search: query, limit: 60 }), `shop:${category ?? ''}:${query}`)
  const products = { ...result, data: result.data ?? result.previous }

  const pickCategory = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('category', id)
    else next.delete('category')
    setParams(next, { replace: true })
  }

  const activeCategory = categories.data?.find((c) => c.id === category)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">{activeCategory ? activeCategory.name : 'Shop'}</h1>

      <div className="mt-5 flex flex-col gap-4">
        <div className="relative max-w-md">
          <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className={`${fieldClass} rounded-full pl-11 pr-10`}
          />
          {text && (
            <button
              type="button"
              onClick={() => setText('')}
              className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full hover:bg-highlight"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {categories.data && categories.data.length > 0 && (
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Categories">
            <button type="button" className={chip(!category)} onClick={() => pickCategory(null)}>All</button>
            {categories.data.map((c) => (
              <button key={c.id} type="button" className={chip(category === c.id)} onClick={() => pickCategory(c.id)}>
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6" aria-live="polite">
        {products.error && <ErrorNote>We couldn’t load the products. Please refresh and try again.</ErrorNote>}
        {products.loading && !products.data && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-[3/4]" />)}
          </div>
        )}
        {products.data && products.data.length === 0 && (
          <EmptyState title="No products found">
            {query ? `Nothing matched “${query}”. Try a different word or clear the search.` : 'There are no products in this category yet.'}
          </EmptyState>
        )}
        {products.data && products.data.length > 0 && (
          <div className={`grid grid-cols-2 gap-4 transition-opacity md:grid-cols-3 lg:grid-cols-4 ${products.loading ? 'opacity-60' : ''}`}>
            {products.data.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
