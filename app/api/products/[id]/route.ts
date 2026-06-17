import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// PATCH — update product
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const update: Record<string, unknown> = {}
  if (body.name           !== undefined) update.name           = body.name
  if (body.category       !== undefined) update.category       = body.category
  if (body.sub_category   !== undefined) update.sub_category   = body.sub_category
  if (body.sale_price     !== undefined) update.sale_price     = Number(body.sale_price)
  if (body.original_price !== undefined) update.original_price = Number(body.original_price)
  if (body.stock          !== undefined) update.stock          = Number(body.stock)
  if (body.notes          !== undefined) update.notes          = body.notes
  if (body.image_url      !== undefined) update.image_url      = body.image_url
  if (body.store_url      !== undefined) update.store_url      = body.store_url
  if (body.alert_enabled  !== undefined) update.alert_enabled  = Boolean(body.alert_enabled)

  const { data, error } = await supabase
    .from('products')
    .update(update)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE — remove product AND remember it so sync/cron never restores it
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Look up the product first so we can record its woo_id (if synced)
  const { data: existing } = await supabase
    .from('products')
    .select('id, name, woo_id')
    .eq('id', params.id)
    .maybeSingle()

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Remember the deletion so future store syncs skip this product
  if (existing?.woo_id) {
    await supabase
      .from('deleted_products')
      .upsert({ woo_id: existing.woo_id, name: existing.name }, { onConflict: 'woo_id' })
  }

  return NextResponse.json({ success: true })
}
