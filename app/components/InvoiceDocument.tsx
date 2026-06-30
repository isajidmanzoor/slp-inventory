'use client'
import type { Invoice, InvoiceItem } from '@/lib/supabase'
import { fmtMoney, fmtDate, balanceDue } from '@/lib/invoice-utils'
import { InvoiceQR } from './InvoiceCodes'

export default function InvoiceDocument({ invoice, items, viewUrl, paymentQrUrl }: {
  invoice: Invoice
  items: InvoiceItem[]
  viewUrl: string
  paymentQrUrl?: string | null
}) {
  const due = balanceDue(invoice)
  const logoUrl = invoice.company_logo_url
    || 'https://smartlivingpakistan.com/wp-content/uploads/2025/07/New-logo-Smart-Living-Pakistan-mobile-7.png.webp'

  return (
    <div id="invoice-doc" className="bg-white mx-auto" style={{ maxWidth: 700, width:'100%', color:'#1C1B19', fontFamily:'Arial,Helvetica,sans-serif' }}>

      {/* ── HEADER: LOGO + TAGLINE ── */}
      <div className="text-center pt-8 pb-4 px-6">
        <div className="flex items-center justify-center gap-2.5">
          <img src={logoUrl} alt="Smart Living Pakistan" style={{ width:48, height:48, objectFit:'contain' }}/>
          <div className="text-left">
            <div style={{ fontSize:22, fontWeight:800, color:'#1A2A7A', letterSpacing:'0.5px', lineHeight:1 }}>SMART LIVING</div>
            <div style={{ fontSize:13, fontWeight:700, color:'#5BA82E', letterSpacing:'4px', marginTop:2 }}>PAKISTAN</div>
          </div>
        </div>
        <div style={{ fontSize:12, color:'#6B6A66', marginTop:6, fontWeight:500 }}>
          Complete Finishing &amp; Smart Living Solutions
        </div>
      </div>

      {/* Green divider line */}
      <div style={{ height:3, background:'#5BA82E', margin:'0 0 18px' }}/>

      <div className="px-6 sm:px-8">
        {/* ── ORDER NUMBER / DATE ── */}
        <div className="flex justify-between items-center pb-4 mb-5" style={{ borderBottom:'1px solid #E4E2DC' }}>
          <div style={{ fontSize:13 }}>
            <span style={{ fontWeight:700 }}>Order Number:</span>{' '}
            <span style={{ color:'#3E3D3A' }}>{invoice.order_id || invoice.invoice_number}</span>
          </div>
          <div style={{ fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontWeight:700 }}>Order Date:</span>
            <span style={{ color:'#3E3D3A' }}>{fmtDate(invoice.invoice_date)}</span>
          </div>
        </div>

        {/* ── CUSTOMER + SHIPPER DETAILS (side by side) ── */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div style={{ fontSize:13, fontWeight:800, marginBottom:8, letterSpacing:'0.3px' }}>CUSTOMER DETAILS</div>
            <DetailRow label="Name" value={invoice.customer_name || '—'}/>
            <DetailRow label="Phone Number" value={invoice.customer_phone || '—'}/>
            <DetailRow label="Address" value={invoice.billing_address || invoice.shipping_address || '—'}/>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:800, marginBottom:8, letterSpacing:'0.3px' }}>SHIPPER DETAILS</div>
            <DetailRow label="Name" value={invoice.shipper_name || 'Smart Living Pvt LTD.'}/>
            <DetailRow label="Phone Number" value={invoice.shipper_phone || '+92 305 7015615'}/>
            <DetailRow label="Address" value={invoice.warehouse_address || 'Warehouse #1, Gulberg 3'}/>
          </div>
        </div>

        {/* ── PRODUCT TABLE ── */}
        <table className="w-full mb-6" style={{ borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#1A2A7A' }}>
              <th style={{ color:'#fff', textAlign:'left', padding:'9px 12px', fontWeight:700, fontSize:12, borderRadius:'6px 0 0 0' }}>Product</th>
              <th style={{ color:'#fff', textAlign:'center', padding:'9px 8px', fontWeight:700, fontSize:12 }}>Quantity</th>
              <th style={{ color:'#fff', textAlign:'right', padding:'9px 8px', fontWeight:700, fontSize:12 }}>Original Price</th>
              <th style={{ color:'#fff', textAlign:'right', padding:'9px 12px', fontWeight:700, fontSize:12, borderRadius:'0 6px 0 0' }}>Discount Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i} style={{ borderBottom:'1px solid #EFEEE9' }}>
                <td style={{ padding:'8px 12px', color:'#1C1B19' }}>{it.product_name}</td>
                <td style={{ padding:'8px', textAlign:'center', color:'#3E3D3A' }}>{it.quantity}</td>
                <td style={{ padding:'8px', textAlign:'right', color:'#3E3D3A' }}>
                  {it.unit_price ? Math.round(it.unit_price + it.discount).toLocaleString() : '—'}
                </td>
                <td style={{ padding:'8px 12px', textAlign:'right', color:'#1C1B19', fontWeight:600 }}>
                  {Math.round(it.unit_price).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── BILL SUMMARY ── */}
        <table className="w-full mb-7" style={{ borderCollapse:'collapse', fontSize:13 }}>
          <tbody>
            <tr style={{ borderBottom:'1px solid #EFEEE9' }}>
              <td style={{ padding:'8px 12px', fontWeight:700 }}>Discounted Bill</td>
              <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700 }}>{fmtMoney(invoice.grand_total, invoice.currency)}/-</td>
            </tr>
            {invoice.amount_paid > 0 && (
              <tr style={{ borderBottom:'1px solid #EFEEE9' }}>
                <td style={{ padding:'8px 12px', fontWeight:700 }}>Advance</td>
                <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:700 }}>{fmtMoney(invoice.amount_paid, invoice.currency)}/-</td>
              </tr>
            )}
            <tr>
              <td style={{ padding:'8px 12px', fontWeight:800 }}>Remaining Total Bill have to Pay</td>
              <td style={{ padding:'8px 12px', textAlign:'center', fontWeight:800, color:'#9B2B2B' }}>{fmtMoney(due, invoice.currency)}/-</td>
            </tr>
          </tbody>
        </table>

        {/* ── WARRANTY / TERMS / SEAL / SIGNATURE ── */}
        <div className="grid grid-cols-3 gap-4 items-start pb-6">
          <div>
            <div style={{ fontSize:12, fontWeight:800, marginBottom:4 }}>WARRANTY</div>
            <div style={{ fontSize:11, color:'#3E3D3A', lineHeight:1.5 }}>
              1 year Warranty.<br/>
              <span style={{ fontSize:10, color:'#9C9B97' }}>(Product Burn &amp; Damage not included)</span>
            </div>
            <div style={{ fontSize:12, fontWeight:800, marginTop:12, marginBottom:4 }}>TERMS &amp; CONDITIONS</div>
            <div style={{ fontSize:11, color:'#3E3D3A', lineHeight:1.5 }}>
              In case of return, Customer has to send us.
            </div>
          </div>

          {/* Gold warranty seal */}
          <div className="flex flex-col items-center justify-center">
            <div style={{
              width:78, height:78, borderRadius:'50%',
              background:'radial-gradient(circle at 35% 30%, #FFE49A, #D9A02B 70%, #B07F1B 100%)',
              border:'3px solid #B07F1B',
              display:'flex', alignItems:'center', justifyContent:'center',
              textAlign:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.15)',
            }}>
              <div style={{ fontSize:9, fontWeight:800, color:'#5C3D00', lineHeight:1.25 }}>
                1 YEAR<br/>WARRANTY<br/>
                <span style={{ fontSize:7, fontWeight:600 }}>SMART LIVING</span>
              </div>
            </div>
          </div>

          {/* Sale person + signature */}
          <div className="text-right">
            <div style={{ fontSize:11, color:'#3E3D3A' }}>
              Your Sale Person: <span style={{ fontWeight:800 }}>{invoice.sale_person || '—'}</span>
            </div>
            <div style={{ height:40, display:'flex', alignItems:'flex-end', justifyContent:'flex-end', marginTop:4 }}>
              {invoice.sale_person && (
                <svg width="70" height="32" viewBox="0 0 70 32">
                  <path d="M4 24 Q 14 6, 22 20 T 38 14 Q 44 8, 50 18 T 66 10"
                    stroke="#1A2A7A" strokeWidth="2" fill="none" strokeLinecap="round"/>
                </svg>
              )}
            </div>
          </div>
        </div>

        {/* ── FOOTER: QR CODES ── */}
        <div className="flex justify-between items-end pb-8" style={{ borderTop:'1px solid #E4E2DC', paddingTop:18 }}>
          <div className="flex flex-col items-start gap-1.5">
            <InvoiceQR value={viewUrl + '?loc=warehouse'} size={58}/>
            <span style={{ fontSize:10, color:'#6B6A66', lineHeight:1.3 }}>
              Smart Living<br/>Pakistan Warehouse
            </span>
          </div>
          <div className="text-center" style={{ fontSize:11, color:'#6B6A66' }}>
            www.Smartlivingpakistan.com
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <InvoiceQR value={viewUrl + '?loc=store'} size={58}/>
            <span style={{ fontSize:10, color:'#6B6A66', textAlign:'right', lineHeight:1.3 }}>
              Smart Living<br/>Pakistan Store
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex" style={{ fontSize:12, marginBottom:4 }}>
      <span style={{ color:'#6B6A66', minWidth:96 }}>{label}</span>
      <span style={{ color:'#1C1B19', fontWeight:500 }}>{value}</span>
    </div>
  )
}
