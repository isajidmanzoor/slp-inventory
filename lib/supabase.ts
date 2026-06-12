import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

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
