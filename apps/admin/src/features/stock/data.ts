import { supabase } from '../../lib/supabase'
import { q } from '../../lib/db'
import type { Category, Product, ProductImage, StockLevel, Supplier } from '../../lib/types'
import { imageUrl } from '../../lib/images'

export interface Location {
  id: string
  name: string
}

export const loadLocation = async (): Promise<Location | null> => {
  const rows = await q<Location[]>(
    supabase.from('locations').select('id,name').eq('is_active', true).order('created_at').limit(1),
  )
  return rows[0] ?? null
}

export type StockStatus = 'ok' | 'low' | 'out'

export interface StockRow {
  product: Product
  quantity: number
  status: StockStatus
  categoryName: string | null
  supplier: Pick<Supplier, 'id' | 'name' | 'phone'> | null
  photo: string | null
}

/** Every product with its live quantity, category, usual supplier and cover photo. */
export const loadStock = async () => {
  const [products, levels, categories, suppliers, images, location] = await Promise.all([
    q<Product[]>(
      supabase
        .from('products')
        .select('id,name,sku,category_id,supplier_id,unit,pack_size,reorder_level,retail_price,wholesale_price,is_active')
        .order('name'),
    ),
    q<StockLevel[]>(supabase.from('stock_levels').select('product_id,quantity')),
    q<Category[]>(supabase.from('categories').select('id,name')),
    q<Pick<Supplier, 'id' | 'name' | 'phone'>[]>(supabase.from('suppliers').select('id,name,phone')),
    q<ProductImage[]>(supabase.from('product_images').select('id,product_id,path,sort_order').order('sort_order')),
    loadLocation(),
  ])

  const qty = new Map<string, number>()
  for (const l of levels) qty.set(l.product_id, (qty.get(l.product_id) ?? 0) + Number(l.quantity))
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const sup = new Map(suppliers.map((s) => [s.id, s]))
  const photo = new Map<string, string>()
  for (const i of images) if (!photo.has(i.product_id)) photo.set(i.product_id, imageUrl(i.path))

  const rows: StockRow[] = products.map((product) => {
    const quantity = qty.get(product.id) ?? 0
    const status: StockStatus = quantity <= 0 ? 'out' : product.reorder_level > 0 && quantity <= product.reorder_level ? 'low' : 'ok'
    return {
      product,
      quantity,
      status,
      categoryName: (product.category_id && cat.get(product.category_id)) || null,
      supplier: (product.supplier_id && sup.get(product.supplier_id)) || null,
      photo: photo.get(product.id) ?? null,
    }
  })
  return { rows, categories, location }
}

export type StockData = Awaited<ReturnType<typeof loadStock>>

/** Names of team members by id, for "recorded by". */
export const loadPeople = async () => {
  const rows = await q<{ id: string; full_name: string | null }[]>(supabase.from('profiles').select('id,full_name'))
  return new Map(rows.map((r) => [r.id, r.full_name || 'Team member']))
}
