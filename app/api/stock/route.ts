import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * PUBLIC STOCK API
 * ─────────────────────────────────────────────────────────
 * GET /api/stock               → all product stock levels
 * GET /api/stock?id=5          → single product stock
 * GET /api/stock?name=Yoga+Mat → by name (partial match)
 *
 * Use this endpoint from your live storefront (WooCommerce,
 * custom site, etc.) to show real-time stock info.
 *
 * CORS is open so any domain can call it.
 * ─────────────────────────────────────────────────────────
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id   = searchParams.get('id')
  const name = searchParams.get('name')

  let query = supabase
    .from('products')
    .select('id, name, category, sub_category, sale_price, original_price, stock, image_url')

  if (id)   query = query.eq('id', id)
  if (name) query = query.ilike('name', `%${name}%`)

  const { data, error } = await query.order('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with computed fields
  const enriched = (data ?? []).map(p => ({
    ...p,
    discount_pct: p.original_price > 0 && p.sale_price > 0
      ? Math.round(((p.original_price - p.sale_price) / p.original_price) * 100)
      : 0,
    in_stock:   p.stock > 0,
    low_stock:  p.stock > 0 && p.stock <= 5,
    out_of_stock: p.stock === 0,
  }))

  const result = id || name ? enriched[0] ?? null : enriched

  return NextResponse.json(result, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',               // Allow any website to call this
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
    }
  })
}
