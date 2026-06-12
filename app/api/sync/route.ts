import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const WOO_BASE = 'https://smartlivingpakistan.com/wp-json/wc/v3'
const WOO_KEY  = process.env.WOO_CONSUMER_KEY  || ''
const WOO_SEC  = process.env.WOO_CONSUMER_SECRET || ''

// Map WooCommerce category slugs / names → our category names
const CAT_MAP: Record<string, string> = {
  'lights': 'Lights', 'lighting': 'Lights',
  'switch-plates': 'Switch Plates', 'switch plates': 'Switch Plates', 'switchboards': 'Switch Plates',
  'smart-home': 'Smart Home', 'smart home': 'Smart Home',
  'hardware': 'Hardware',
  'wall-decor': 'Wall Decor', 'wall decor': 'Wall Decor',
  'gym': 'Gym', 'fitness': 'Gym',
  'home-decor': 'Home Decor', 'home decor': 'Home Decor',
}

function mapCategory(wooCategories: { name: string; slug: string }[]): string {
  for (const c of wooCategories) {
    const mapped = CAT_MAP[c.slug?.toLowerCase()] || CAT_MAP[c.name?.toLowerCase()]
    if (mapped) return mapped
  }
  return wooCategories[0]?.name || 'Other'
}

async function fetchAllWooProducts(): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while (true) {
    const params = new URLSearchParams({
      per_page: '100',
      page: String(page),
      status: 'publish',
      consumer_key: WOO_KEY,
      consumer_secret: WOO_SEC,
    })
    const res = await fetch(`${WOO_BASE}/products?${params}`, {
      next: { revalidate: 0 },
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) break
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < 100) break
    page++
  }
  return all
}

export async function POST(req: NextRequest) {
  // Require auth
  const authHeader = req.headers.get('authorization')
  const syncSecret = process.env.SYNC_SECRET || ''
  if (syncSecret && authHeader !== `Bearer ${syncSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let added = 0, updated = 0
  let status = 'ok', message = ''

  try {
    // If no WooCommerce credentials, return graceful message
    if (!WOO_KEY || !WOO_SEC) {
      return NextResponse.json({
        ok: false,
        error: 'WooCommerce API keys not configured. Add WOO_CONSUMER_KEY and WOO_CONSUMER_SECRET to your environment variables.',
      }, { status: 200 })
    }

    const wooProducts = await fetchAllWooProducts()

    for (const wp of wooProducts) {
      const name = wp.name?.replace(/<[^>]+>/g, '').trim()
      if (!name) continue

      const salePrice = parseFloat(wp.sale_price || wp.price || '0') || 0
      const origPrice = parseFloat(wp.regular_price || '0') || 0
      const stock     = wp.stock_quantity ?? (wp.in_stock ? 10 : 0)
      const imageUrl  = wp.images?.[0]?.src || null
      const category  = mapCategory(wp.categories || [])
      const subCat    = wp.categories?.[1]?.name || ''

      // Check if exists by woo_id or name
      const { data: existing } = await supabase
        .from('products')
        .select('id, name, stock')
        .or(`woo_id.eq.${wp.id},name.ilike.${name}`)
        .maybeSingle()

      if (existing) {
        await supabase.from('products').update({
          name, category, sub_category: subCat,
          sale_price: salePrice, original_price: origPrice,
          stock, image_url: imageUrl,
          woo_id: wp.id, last_synced_at: new Date().toISOString(),
        }).eq('id', existing.id)
        updated++
      } else {
        await supabase.from('products').insert({
          name, category, sub_category: subCat,
          sale_price: salePrice, original_price: origPrice,
          stock: stock || 0, notes: '',
          image_url: imageUrl,
          woo_id: wp.id, last_synced_at: new Date().toISOString(),
        })
        added++
      }
    }

    // Log sync
    await supabase.from('sync_log').insert({
      added, updated, total_found: wooProducts.length, status: 'ok',
    })

    return NextResponse.json({ ok: true, added, updated, total: wooProducts.length })
  } catch (err: any) {
    status = 'error'
    message = err?.message || 'Unknown error'
    await supabase.from('sync_log').insert({ added, updated, total_found: 0, status, message })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

// GET — last sync info
export async function GET() {
  const { data } = await supabase
    .from('sync_log')
    .select('*')
    .order('synced_at', { ascending: false })
    .limit(5)
  return NextResponse.json(data ?? [])
}
