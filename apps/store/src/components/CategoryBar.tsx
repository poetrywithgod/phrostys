import { Link, useSearchParams } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { fetchCategories } from '../lib/api'
import { useCart } from '../lib/cart'
import { formatNaira } from '../lib/format'
import { useAsync } from '../lib/useAsync'

/** The tinted strip under the header: category links on the left, live cart total on the right. */
export default function CategoryBar() {
  const { subtotal, count } = useCart()
  const categories = useAsync(fetchCategories, 'bar-categories')
  const [params] = useSearchParams()
  const active = params.get('category')

  return (
    <div className="border-t border-border bg-highlight/70">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4">
        <nav aria-label="Categories" className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto py-1.5">
          <Link to="/shop" className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-surface ${!active ? 'text-primary' : ''}`}>
            All products
          </Link>
          {categories.data?.map((c) => (
            <Link
              key={c.id}
              to={`/shop?category=${c.id}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-surface ${active === c.id ? 'bg-surface text-primary' : ''}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>
        <Link to="/cart" className="flex shrink-0 items-center gap-2 py-1.5 font-display text-base font-semibold" aria-label={`Cart total ${formatNaira(subtotal)}, ${count} items`}>
          <ShoppingBag size={18} />
          <span>{formatNaira(subtotal)}</span>
        </Link>
      </div>
    </div>
  )
}
