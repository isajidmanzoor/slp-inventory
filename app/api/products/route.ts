import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET all products (with optional ?category= and ?q= filters)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const q        = searchParams.get('q')

  let query = supabase
    .from('products')
    .select('*')
    .order('id', { ascending: true })

  if (category && category !== 'All') query = query.eq('category', category)
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'no-store' }
  })
}

// POST — create new product
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { data, error } = await supabase
    .from('products')
    .insert([{
      name:           body.name,
      category:       body.category,
      sub_category:   body.sub_category   || '',
      sale_price:     Number(body.sale_price)     || 0,
      original_price: Number(body.original_price) || 0,
      stock:          Number(body.stock)          || 0,
      notes:          body.notes          || '',
      image_url:      body.image_url      || null,
    }])
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
