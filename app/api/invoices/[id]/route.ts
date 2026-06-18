import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcInvoiceTotals } from '@/lib/invoice-utils'
import type { InvoiceItem } from '@/lib/supabase'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data: invoice, error: invErr } = await supabase
    .from('invoices').select('*').eq('id', params.id).single()
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 404 })

  const { data: items, error: itemsErr } = await supabase
    .from('invoice_items').select('*').eq('invoice_id', params.id).order('sort_order')
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  return NextResponse.json({ ...invoice, items }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const items: InvoiceItem[] | undefined = Array.isArray(body.items) ? body.items : undefined

    const update: Record<string, unknown> = {}
    const directFields = [
      'order_id','invoice_date','due_date','payment_status','company_logo_url',
      'customer_name','customer_email','customer_phone','billing_address','shipping_address',
      'currency','payment_method','transaction_id','payment_date','amount_paid',
      'courier_name','tracking_number','delivery_status','notes',
      'shipping_charges','delivery_tax',
    ]
    for (const f of directFields) if (body[f] !== undefined) update[f] = body[f]

    // If items were re-supplied, recalculate totals and replace all line items
    if (items) {
      const shippingCharges = Number(body.shipping_charges ?? update.shipping_charges ?? 0) || 0
      const deliveryTax     = Number(body.delivery_tax ?? update.delivery_tax ?? 0) || 0
      const extraDiscount   = Number(body.extra_discount) || 0
      const { subtotal, discountAmount, taxAmount, grandTotal } =
        calcInvoiceTotals(items, shippingCharges, deliveryTax, extraDiscount)
      update.subtotal        = subtotal
      update.discount_amount = discountAmount
      update.tax_amount      = taxAmount
      update.grand_total     = grandTotal

      await supabase.from('invoice_items').delete().eq('invoice_id', params.id)
      const itemsToInsert = items.map((it, idx) => ({
        invoice_id:   Number(params.id),
        product_id:   it.product_id || null,
        product_name: it.product_name,
        sku:          it.sku || '',
        quantity:     it.quantity,
        unit_price:   it.unit_price,
        discount:     it.discount || 0,
        tax_pct:      it.tax_pct || 0,
        line_total:   it.line_total,
        sort_order:   idx,
      }))
      const { error: itemsErr } = await supabase.from('invoice_items').insert(itemsToInsert)
      if (itemsErr) throw itemsErr
    }

    const { data, error } = await supabase
      .from('invoices').update(update).eq('id', params.id).select().single()
    if (error) throw error

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update invoice'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await supabase.from('invoices').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
