import { createClient, SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const missingSupabaseEnv = !supabaseUrl || !supabaseKey
const missingSupabaseMessage =
  'Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'

function createMissingSupabaseClient(): SupabaseClient {
  const throwError = () => { throw new Error(missingSupabaseMessage) }
  const proxy = new Proxy(throwError, {
    get() { return proxy },
    apply() { return throwError() },
  })
  return proxy as unknown as SupabaseClient
}

export const supabase = missingSupabaseEnv
  ? createMissingSupabaseClient()
  : createClient(supabaseUrl, supabaseKey)

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
export function supabaseAdmin(): SupabaseClient {
  if (!supabaseUrl || !serviceRoleKey) {
    return createMissingSupabaseClient()
  }
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export type Product = {
  id: number
  name: string
  category: string
  sub_category: string
  sale_price: number
  original_price: number
  stock: number
  notes: string
  image_url: string | null
  store_url?: string | null
  alert_enabled: boolean
  woo_id?: number | null
  last_synced_at?: string | null
  created_at?: string
  updated_at?: string
}

export type Profile = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  role: 'admin' | 'staff'
  low_stock_threshold?: number | null
  created_at?: string
}

export type SyncLog = {
  id: number
  synced_at: string
  added: number
  updated: number
  total_found: number
  status: string
  message?: string
}

export type InvoiceItem = {
  id?: number
  invoice_id?: number
  product_id: number | null
  product_name: string
  sku: string
  quantity: number
  unit_price: number
  discount: number
  tax_pct: number
  line_total: number
}

export type Invoice = {
  id: number
  invoice_number: string
  order_id: string | null
  invoice_date: string
  due_date: string | null
  payment_status: 'Paid' | 'Unpaid' | 'Partial' | 'Refunded'
  company_logo_url: string | null

  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  billing_address: string
  shipping_address: string

  subtotal: number
  shipping_charges: number
  discount_amount: number
  tax_amount: number
  delivery_tax: number
  grand_total: number
  currency: string

  payment_method: 'Card' | 'Bank' | 'COD' | 'Wallet' | null
  transaction_id: string | null
  payment_date: string | null
  amount_paid: number

  courier_name: string | null
  tracking_number: string | null
  delivery_status: 'Pending' | 'Shipped' | 'Out for Delivery' | 'Delivered' | 'Returned' | null

  notes: string | null
  public_token: string

  created_at?: string
  updated_at?: string
  items?: InvoiceItem[]
}
