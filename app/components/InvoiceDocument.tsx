'use client'
import type { Invoice, InvoiceItem } from '@/lib/supabase'
import { fmtMoney, fmtDate, balanceDue, PAYMENT_STATUS_COLORS, DELIVERY_STATUS_COLORS } from '@/lib/invoice-utils'
import { InvoiceQR, InvoiceBarcode } from './InvoiceCodes'
import { Truck, MapPin, Phone, Mail } from 'lucide-react'

export default function InvoiceDocument({ invoice, items, viewUrl, paymentQrUrl }: {
  invoice: Invoice
  items: InvoiceItem[]
  viewUrl: string
  paymentQrUrl?: string | null
}) {
  const statusStyle   = PAYMENT_STATUS_COLORS[invoice.payment_status]  || { bg:'#F1EFE8', color:'#6B6A66' }
  const deliveryStyle = invoice.delivery_status ? (DELIVERY_STATUS_COLORS[invoice.delivery_status] || { bg:'#F1EFE8', color:'#6B6A66' }) : null
  const due = balanceDue(invoice)

  return (
    <div id="invoice-doc" className="bg-white mx-auto" style={{ maxWidth: 820, width:'100%', color:'#1C1B19' }}>
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-6 sm:p-8 border-b" style={{ borderColor:'#E4E2DC' }}>
        <div className="flex items-center gap-3">
          {invoice.company_logo_url
            ? <img src={invoice.company_logo_url} alt="Company logo" className="w-14 h-14 rounded-xl object-cover border" style={{ borderColor:'#E4E2DC' }}/>
            : <img src="https://smartlivingpakistan.com/wp-content/uploads/2025/07/New-logo-Smart-Living-Pakistan-mobile-7.png.webp" alt="SLP" className="w-14 h-14 rounded-xl object-contain"/>
          }
          <div>
            <div className="text-lg font-bold">Smart Living Pakistan</div>
            <div className="text-xs" style={{ color:'#9C9B97' }}>smartlivingpakistan.com</div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-2xl font-extrabold tracking-tight" style={{ color:'#1A5FA8' }}>INVOICE</div>
          <div className="text-sm font-semibold mt-1">{invoice.invoice_number}</div>
          <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold"
            style={{ background: statusStyle.bg, color: statusStyle.color }}>
            {invoice.payment_status}
          </span>
        </div>
      </div>

      {/* ── META GRID: dates / order / customer ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 p-6 sm:p-8 border-b" style={{ borderColor:'#E4E2DC' }}>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color:'#9C9B97' }}>Invoice Details</div>
          <Row label="Invoice Date" value={fmtDate(invoice.invoice_date)}/>
          <Row label="Due Date"     value={fmtDate(invoice.due_date)}/>
          <Row label="Order ID"     value={invoice.order_id || '—'}/>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color:'#9C9B97' }}>Bill To</div>
          <div className="text-sm font-semibold">{invoice.customer_name}</div>
          {invoice.customer_email && (
            <div className="text-xs flex items-center gap-1.5 mt-1" style={{ color:'#6B6A66' }}>
              <Mail size={11}/> {invoice.customer_email}
            </div>
          )}
          {invoice.customer_phone && (
            <div className="text-xs flex items-center gap-1.5 mt-1" style={{ color:'#6B6A66' }}>
              <Phone size={11}/> {invoice.customer_phone}
            </div>
          )}
          {invoice.billing_address && (
            <div className="text-xs flex items-start gap-1.5 mt-1" style={{ color:'#6B6A66' }}>
              <MapPin size={11} className="mt-0.5 flex-shrink-0"/> <span>{invoice.billing_address}</span>
            </div>
          )}
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color:'#9C9B97' }}>Ship To</div>
          <div className="text-xs flex items-start gap-1.5" style={{ color:'#6B6A66' }}>
            <Truck size={11} className="mt-0.5 flex-shrink-0"/>
            <span>{invoice.shipping_address || invoice.billing_address || '—'}</span>
          </div>
          {invoice.courier_name && <Row label="Courier" value={invoice.courier_name}/>}
          {invoice.tracking_number && <Row label="Tracking #" value={invoice.tracking_number}/>}
          {deliveryStyle && invoice.delivery_status && (
            <span className="inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: deliveryStyle.bg, color: deliveryStyle.color }}>
              {invoice.delivery_status}
            </span>
          )}
        </div>
      </div>

      {/* ── LINE ITEMS ── */}
      <div className="p-6 sm:p-8">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm" style={{ minWidth: 520 }}>
            <thead>
              <tr style={{ background:'#F5F4F0' }}>
                <th className="text-left font-bold py-2 px-3 rounded-l-lg" style={{ fontSize:11, color:'#6B6A66' }}>ITEM</th>
                <th className="text-left font-bold py-2 px-3" style={{ fontSize:11, color:'#6B6A66' }}>SKU</th>
                <th className="text-center font-bold py-2 px-3" style={{ fontSize:11, color:'#6B6A66' }}>QTY</th>
                <th className="text-right font-bold py-2 px-3" style={{ fontSize:11, color:'#6B6A66' }}>PRICE</th>
                <th className="text-right font-bold py-2 px-3" style={{ fontSize:11, color:'#6B6A66' }}>DISC.</th>
                <th className="text-right font-bold py-2 px-3" style={{ fontSize:11, color:'#6B6A66' }}>TAX %</th>
                <th className="text-right font-bold py-2 px-3 rounded-r-lg" style={{ fontSize:11, color:'#6B6A66' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-b" style={{ borderColor:'#F0EEE8' }}>
                  <td className="py-2.5 px-3 font-medium">{it.product_name}</td>
                  <td className="py-2.5 px-3" style={{ color:'#9C9B97', fontSize:12 }}>{it.sku || '—'}</td>
                  <td className="py-2.5 px-3 text-center">{it.quantity}</td>
                  <td className="py-2.5 px-3 text-right">{fmtMoney(it.unit_price, 'PKR')}</td>
                  <td className="py-2.5 px-3 text-right" style={{ color:'#9B2B2B' }}>{it.discount > 0 ? `-${fmtMoney(it.discount, 'PKR')}` : '—'}</td>
                  <td className="py-2.5 px-3 text-right">{it.tax_pct > 0 ? `${it.tax_pct}%` : '—'}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{fmtMoney(it.line_total, 'PKR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── TOTALS + CODES ── */}
        <div className="flex flex-col sm:flex-row justify-between gap-6 mt-6">
          <div className="flex flex-wrap gap-6 items-start">
            <InvoiceBarcode value={invoice.invoice_number}/>
            <InvoiceQR value={viewUrl} size={84} label="Scan to view invoice"/>
            {paymentQrUrl && (
              <div className="flex flex-col items-center gap-1">
                <img src={paymentQrUrl} width={84} height={84} alt="Payment QR" style={{ borderRadius:8, border:'1px solid #E4E2DC' }}/>
                <span style={{ fontSize:9, color:'#9C9B97' }}>Scan to pay</span>
              </div>
            )}
          </div>

          <div className="w-full sm:w-72 space-y-1.5 text-sm">
            <TotalRow label="Subtotal" value={fmtMoney(invoice.subtotal, 'PKR')}/>
            {invoice.discount_amount > 0 && <TotalRow label="Discount" value={`-${fmtMoney(invoice.discount_amount, 'PKR')}`} color="#9B2B2B"/>}
            {invoice.tax_amount > 0 && <TotalRow label="Tax" value={fmtMoney(invoice.tax_amount, 'PKR')}/>}
            {invoice.shipping_charges > 0 && <TotalRow label="Shipping" value={fmtMoney(invoice.shipping_charges, 'PKR')}/>}
            {invoice.delivery_tax > 0 && <TotalRow label="Delivery Tax" value={fmtMoney(invoice.delivery_tax, 'PKR')}/>}
            <div className="pt-2 mt-1 border-t" style={{ borderColor:'#1A5FA8' }}>
              <TotalRow label="Grand Total" value={fmtMoney(invoice.grand_total, 'PKR')} bold big/>
            </div>
            {invoice.amount_paid > 0 && <TotalRow label="Amount Paid" value={fmtMoney(invoice.amount_paid, 'PKR')} color="#0D6E4F"/>}
            {due > 0 && <TotalRow label="Balance Due" value={fmtMoney(due, 'PKR')} color="#9B2B2B" bold/>}
          </div>
        </div>

        {/* ── PAYMENT INFO ── */}
        {(invoice.payment_method || invoice.transaction_id) && (
          <div className="mt-6 p-4 rounded-xl" style={{ background:'#F5F4F0' }}>
            <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color:'#9C9B97' }}>Payment Information</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {invoice.payment_method && <Row label="Method" value={invoice.payment_method}/>}
              {invoice.transaction_id && <Row label="Transaction ID" value={invoice.transaction_id}/>}
              {invoice.payment_date   && <Row label="Payment Date" value={fmtDate(invoice.payment_date)}/>}
            </div>
          </div>
        )}

        {/* ── NOTES ── */}
        {invoice.notes && (
          <div className="mt-6">
            <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color:'#9C9B97' }}>Notes &amp; Terms</div>
            <p className="text-xs whitespace-pre-wrap" style={{ color:'#6B6A66' }}>{invoice.notes}</p>
          </div>
        )}
      </div>

      <div className="text-center py-5 border-t text-[11px]" style={{ borderColor:'#E4E2DC', color:'#9C9B97' }}>
        Thank you for shopping with Smart Living Pakistan
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-xs mt-1">
      <span style={{ color:'#9C9B97' }}>{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

function TotalRow({ label, value, bold, big, color }: { label:string; value:string; bold?:boolean; big?:boolean; color?:string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span style={{ color: color || '#6B6A66', fontWeight: bold ? 700 : 500, fontSize: big ? 15 : 13 }}>{label}</span>
      <span style={{ color: color || '#1C1B19', fontWeight: bold ? 800 : 600, fontSize: big ? 18 : 13 }}>{value}</span>
    </div>
  )
}
