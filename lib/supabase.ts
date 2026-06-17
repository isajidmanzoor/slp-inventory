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
