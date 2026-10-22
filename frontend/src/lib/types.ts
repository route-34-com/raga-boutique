export type Image = { id: number; url: string }
export type VariantStock = { size: string; stock: number }

export type Product = {
  id: number
  slug: string
  name: string
  raga: string
  category_id: string
  mood: string
  price: number
  mrp: number | null
  tag: string
  swatch: string
  images: Image[]
  variants: VariantStock[]
  total_stock: number
}

export type ProductDetail = Product & { raga_note: string; details: string[]; care: string }
export type AdminProduct = ProductDetail & { active: boolean; sort: number }

export type Category = { id: string; name: string; sort: number; active: boolean }
export type AdminCategory = Category & { products: number }

export type User = { id: number; phone: string; name: string; email: string; is_admin: boolean }

export type Address = {
  id?: number
  name: string
  phone: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
}

export type OrderStatus = "placed" | "confirmed" | "packed" | "shipped" | "delivered" | "cancelled"

export type OrderItem = {
  product_id: number | null
  name: string
  raga: string
  image: string
  size: string | null
  qty: number
  price: number
}

export type OrderSummary = {
  id: number
  order_no: string
  status: OrderStatus
  total: number
  created_at: string
  items: OrderItem[]
  item_count: number
}

export type AdminOrderRow = OrderSummary & {
  customer_name: string
  phone: string
  payment_method: string
  payment_status: string
}

export type OrderDetail = AdminOrderRow & {
  email: string
  address: Address
  subtotal: number
  shipping: number
  courier: string
  tracking_id: string
  note: string
  events: { status: OrderStatus; note: string; created_at: string }[]
}

export type StoreSettings = { free_ship_above: number; ship_fee: number; low_stock_at?: number }
