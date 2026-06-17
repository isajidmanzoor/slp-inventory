import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const WOO_BASE = 'https://smartlivingpakistan.com/wp-json/wc/v3'
const WOO_KEY = process.env.WOO_CONSUMER_KEY || ''
const WOO_SEC = process.env.WOO_CONSUMER_SECRET || ''

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
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`WooCommerce API error ${res.status} ${res.statusText}: ${body}`)
    }
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < 100) break
    page++
  }
  return all
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET || ''
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!WOO_KEY || !WOO_SEC) {
    return NextResponse.json({ ok: false, error: 'WooCommerce credentials not configured' }, { status: 200 })
  }

  try {
    let added = 0, updated = 0, skippedDeleted = 0
    const wooProducts = await fetchAllWooProducts()

    // Respect manual deletions: never resurrect a product the user removed
    const { data: deletedRows } = await supabase.from('deleted_products').select('woo_id')
    const deletedWooIds = new Set((deletedRows ?? []).map((r: any) => r.woo_id))

    for (const wp of wooProducts) {
      const name = wp.name?.replace(/<[^>]+>/g, '').trim()
      if (!name) continue
      if (deletedWooIds.has(wp.id)) { skippedDeleted++; continue }

      const salePrice = parseFloat(wp.sale_price || wp.price || '0') || 0
      const origPrice = parseFloat(wp.regular_price || '0') || 0
      const stock = wp.stock_quantity ?? (wp.in_stock ? 10 : 0)

      let imageUrl: string | null = null
      if (Array.isArray(wp.images) && wp.images.length > 0) {
        const firstImg = wp.images[0]?.src
        if (firstImg && typeof firstImg === 'string' && firstImg.trim()) imageUrl = firstImg.trim()
      }
      const storeUrl = typeof wp.permalink === 'string' ? wp.permalink : null
      const category = mapCategory(wp.categories || [])
      const subCat = wp.categories?.[1]?.name || ''

      const { data: existing } = await supabase
        .from('products')
        .select('id, name, stock, image_url')
        .or(`woo_id.eq.${wp.id},name.ilike.${name}`)
        .maybeSingle()

      if (existing) {
        const finalImage = imageUrl || existing.image_url || null
        await supabase.from('products').update({
          name, category, sub_category: subCat,
          sale_price: salePrice, original_price: origPrice,
          stock, image_url: finalImage, store_url: storeUrl,
          woo_id: wp.id, last_synced_at: new Date().toISOString(),
        }).eq('id', existing.id)
        updated++
      } else {
        await supabase.from('products').insert({
          name, category, sub_category: subCat,
          sale_price: salePrice, original_price: origPrice,
          stock: stock || 0, notes: '',
          image_url: imageUrl, store_url: storeUrl,
          woo_id: wp.id, last_synced_at: new Date().toISOString(),
          alert_enabled: true,
        })
        added++
      }
    }

    await supabase.from('sync_log').insert({
      added, updated, total_found: wooProducts.length, status: 'ok',
      message: skippedDeleted > 0 ? `Skipped ${skippedDeleted} manually-deleted product(s)` : null,
    })

    return NextResponse.json({ ok: true, added, updated, total: wooProducts.length, skippedDeleted, timestamp: new Date().toISOString() })
  } catch (err: any) {
    const message = err?.message || 'Unknown error'
    await supabase.from('sync_log').insert({ added: 0, updated: 0, total_found: 0, status: 'error', message })
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
