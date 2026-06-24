import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fmtMoney, fmtDate, balanceDue } from '@/lib/invoice-utils'
import nodemailer from 'nodemailer'

function buildEmailHtml(invoice: any, items: any[], viewUrl: string) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(it.product_name)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmtMoney(it.unit_price, invoice.currency)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmtMoney(it.line_total, invoice.currency)}</td>
    </tr>
  `).join('')

  return `
  <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1C1B19">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:36px">🏬</div>
      <h2 style="color:#1A5FA8;margin:6px 0">Smart Living Pakistan</h2>
    </div>
    <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;padding:20px">
      <table style="width:100%;margin-bottom:16px">
        <tr>
          <td><strong>Invoice #</strong><br>${esc(invoice.invoice_number)}</td>
          <td style="text-align:right"><strong>Date</strong><br>${fmtDate(invoice.invoice_date)}</td>
        </tr>
      </table>
      <p>Dear ${esc(invoice.customer_name)},</p>
      <p>Please find your invoice details below.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead>
          <tr style="background:#EFF6FF">
            <th style="padding:8px;text-align:left">Item</th>
            <th style="padding:8px;text-align:center">Qty</th>
            <th style="padding:8px;text-align:right">Price</th>
            <th style="padding:8px;text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <table style="width:100%;margin-top:12px">
        <tr><td>Subtotal</td><td style="text-align:right">${fmtMoney(invoice.subtotal, invoice.currency)}</td></tr>
        <tr><td>Discount</td><td style="text-align:right">-${fmtMoney(invoice.discount_amount, invoice.currency)}</td></tr>
        <tr><td>Tax</td><td style="text-align:right">${fmtMoney(invoice.tax_amount, invoice.currency)}</td></tr>
        <tr><td>Shipping</td><td style="text-align:right">${fmtMoney(invoice.shipping_charges, invoice.currency)}</td></tr>
        <tr style="font-weight:bold;font-size:16px;border-top:2px solid #1A5FA8">
          <td style="padding-top:8px">Grand Total</td>
          <td style="text-align:right;padding-top:8px">${fmtMoney(invoice.grand_total, invoice.currency)}</td>
        </tr>
        <tr><td>Balance Due</td><td style="text-align:right;color:#9B2B2B;font-weight:bold">${fmtMoney(balanceDue(invoice), invoice.currency)}</td></tr>
      </table>
      <div style="text-align:center;margin-top:20px">
        <a href="${viewUrl}" style="background:#1A5FA8;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block">
          View Full Invoice
        </a>
      </div>
    </div>
    <p style="color:#9C9B97;font-size:12px;text-align:center;margin-top:16px">
      Smart Living Pakistan · smartlivingpakistan.com
    </p>
  </div>`
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const { data: invoice, error: invErr } = await supabase
      .from('invoices').select('*').eq('id', params.id).single()
    if (invErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })

    const toEmail = body.to || invoice.customer_email
    if (!toEmail) return NextResponse.json({ error: 'No recipient email address' }, { status: 400 })

    const { data: items } = await supabase
      .from('invoice_items').select('*').eq('invoice_id', params.id).order('sort_order')

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    const viewUrl = `${appUrl}/invoice/${invoice.public_token}`

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return NextResponse.json({
        error: 'Email is not configured yet. Add SMTP_HOST, SMTP_USER, and SMTP_PASS in your environment variables (see .env.example).'
      }, { status: 500 })
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Smart Living Pakistan <${process.env.SMTP_USER}>`,
      to: toEmail,
      subject: `Invoice ${invoice.invoice_number} — Smart Living Pakistan`,
      html: buildEmailHtml(invoice, items || [], viewUrl),
    })

    return NextResponse.json({ success: true, sentTo: toEmail })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
