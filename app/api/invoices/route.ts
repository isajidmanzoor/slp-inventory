import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { calcInvoiceTotals } from '@/lib/invoice-utils'
import type { InvoiceItem } from '@/lib/supabase'

// GET — list invoices (with optional search/status filter)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const q      = searchParams.get('q')

  let query = supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })

  if (status && status !== 'All') query = query.eq('payment_status', status)
  if (q) query = query.or(`invoice_number.ilike.%${q}%,customer_name.ilike.%${q}%,order_id.ilike.%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}

// POST — create a new invoice + its line items
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const items: InvoiceItem[] = Array.isArray(body.items) ? body.items : []

    if (!body.customer_name?.trim()) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 })
    }
    if (items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 })
    }

    const shippingCharges = Number(body.shipping_charges) || 0
    const deliveryTax     = Number(body.delivery_tax) || 0
    const extraDiscount   = Number(body.extra_discount) || 0

    const { subtotal, discountAmount, taxAmount, grandTotal } =
      calcInvoiceTotals(items, shippingCharges, deliveryTax, extraDiscount)

    // Generate the next sequential invoice number via the DB function
    const { data: numData, error: numErr } = await supabase.rpc('generate_invoice_number')
    if (numErr) throw numErr
    const invoiceNumber = numData as string

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .insert({
        invoice_number:    invoiceNumber,
        order_id:          body.order_id || null,
        invoice_date:      body.invoice_date || new Date().toISOString().slice(0,10),
        due_date:          body.due_date || null,
        payment_status:    body.payment_status || 'Unpaid',
        company_logo_url:  body.company_logo_url || null,

        customer_name:     body.customer_name.trim(),
        customer_email:    body.customer_email || null,
        customer_phone:    body.customer_phone || null,
        billing_address:   body.billing_address || '',
        shipping_address:  body.shipping_address || body.billing_address || '',

        subtotal,
        shipping_charges:  shippingCharges,
        discount_amount:   discountAmount,
        tax_amount:        taxAmount,
        delivery_tax:      deliveryTax,
        grand_total:       grandTotal,
        currency:          body.currency || 'PKR',

        payment_method:    body.payment_method || null,
        transaction_id:    body.transaction_id || null,
        payment_date:      body.payment_date || null,
        amount_paid:       Number(body.amount_paid) || 0,

        courier_name:      body.courier_name || null,
        tracking_number:   body.tracking_number || null,
        delivery_status:   body.delivery_status || 'Pending',

        notes:             body.notes || null,
      })
      .select()
      .single()

    if (invErr) throw invErr

    const itemsToInsert = items.map((it, idx) => ({
      invoice_id:   invoice.id,
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

    return NextResponse.json({ ...invoice, items: itemsToInsert }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create invoice'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
