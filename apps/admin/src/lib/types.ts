export interface Category {
  id: string
  name: string
}

export interface Supplier {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
  is_active: boolean
}

export interface Product {
  id: string
  name: string
  sku: string | null
  category_id: string | null
  supplier_id: string | null
  unit: string
  pack_size: number
  reorder_level: number
  retail_price: number
  wholesale_price: number | null
  is_active: boolean
}

export interface ProductImage {
  id: string
  product_id: string
  path: string
  sort_order: number
}
