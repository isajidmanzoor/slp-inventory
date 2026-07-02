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
    <div id="invoice-doc" className="bg-white mx-auto" style={{ maxWidth: 700, width:'100%', color:'#1C1B19', fontFamily:'Arial,Helvetica,sans-serif', minHeight:'297mm', display:'flex', flexDirection:'column' }}>

      {/* ── HEADER: LOGO + TAGLINE ── */}
      <div className="text-center pt-6 pb-3 px-6">
        <div className="flex items-center justify-center">
          <img 
            src="https://smartlivingpakistan.com/wp-content/uploads/2025/07/New-logo-Smart-Living-Pakistan-mobile-7.png.webp"
            alt="Smart Living Pakistan"
            style={{ height:60, width:'auto', objectFit:'contain' }}
          />
        </div>
        <div style={{ fontSize:11, color:'#6B6A66', marginTop:5, fontWeight:500, letterSpacing:'0.3px' }}>
          Complete Finishing &amp; Smart Living Solutions
        </div>
      </div>

      {/* Green divider line */}
      <div style={{ height:3, background:'#5BA82E', margin:'0 0 18px' }}/>

      <div className="px-6 sm:px-8" style={{ flex:1, display:"flex", flexDirection:"column" }}>
        {/* ── ORDER + SHIPPER (left=order, right=shipper) / CUSTOMER below left ── */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* LEFT: Order Number + Date + Customer Details */}
          <div>
            <div style={{ fontSize:13, marginBottom:6, paddingBottom:6, borderBottom:'1px solid #E4E2DC' }}>
              <span style={{ fontWeight:700 }}>Order Number:</span>{' '}
              <span style={{ color:'#3E3D3A' }}>{invoice.order_id || invoice.invoice_number}</span>
            </div>
            <div style={{ fontSize:13, marginBottom:12 }}>
              <span style={{ fontWeight:700 }}>Order Date:</span>{' '}
              <span style={{ color:'#3E3D3A' }}>{fmtDate(invoice.invoice_date)}</span>
            </div>
            <div style={{ fontSize:13, fontWeight:800, marginBottom:8, letterSpacing:'0.3px' }}>CUSTOMER DETAILS</div>
            <DetailRow label="Name" value={invoice.customer_name || '—'}/>
            <DetailRow label="Phone Number" value={invoice.customer_phone || '—'}/>
            <DetailRow label="Address" value={invoice.billing_address || invoice.shipping_address || '—'}/>
          </div>
          {/* RIGHT: Shipper Details (below order date area) */}
          <div style={{ paddingTop:52 }}>
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

        {/* ── WARRANTY + SEAL + QR CODES — ALL ONE ROW ── */}
        <div style={{ borderTop:'1px solid #E4E2DC', paddingTop:14, paddingBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>

          {/* Left: Warranty text */}
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:800, marginBottom:3 }}>WARRANTY</div>
            <div style={{ fontSize:10, color:'#3E3D3A', lineHeight:1.4 }}>
              1 year Warranty.<br/>
              <span style={{ fontSize:9, color:'#9C9B97' }}>(Product Burn &amp; Damage not included)</span>
            </div>
            <div style={{ fontSize:12, fontWeight:800, marginTop:8, marginBottom:3 }}>TERMS &amp; CONDITIONS</div>
            <div style={{ fontSize:10, color:'#3E3D3A', lineHeight:1.4 }}>
              In case of return, Customer has to send us.
            </div>
          </div>

          {/* Center: Gold seal */}
          <div style={{ flexShrink:0 }}>
            <svg width="80" height="80" viewBox="0 0 90 90" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="sealGrad" cx="38%" cy="32%" r="60%">
                  <stop offset="0%" stopColor="#FFE49A"/>
                  <stop offset="60%" stopColor="#D9A02B"/>
                  <stop offset="100%" stopColor="#B07F1B"/>
                </radialGradient>
              </defs>
              {[0,15,30,45,60,75,90,105,120,135,150,165,180,195,210,225,240,255,270,285,300,315,330,345].map((angle, i) => (
                <line key={i}
                  x1={45 + 36 * Math.cos(angle * Math.PI / 180)}
                  y1={45 + 36 * Math.sin(angle * Math.PI / 180)}
                  x2={45 + 44 * Math.cos(angle * Math.PI / 180)}
                  y2={45 + 44 * Math.sin(angle * Math.PI / 180)}
                  stroke="#B07F1B" strokeWidth="2"/>
              ))}
              <circle cx="45" cy="45" r="35" fill="url(#sealGrad)" stroke="#B07F1B" strokeWidth="2.5"/>
              <circle cx="45" cy="45" r="30" fill="none" stroke="#5C3D00" strokeWidth="0.8" strokeDasharray="2,2"/>
              <text x="45" y="33" textAnchor="middle" fontSize="8" fontWeight="900" fill="#5C3D00" fontFamily="Arial">1 YEAR</text>
              <text x="45" y="43" textAnchor="middle" fontSize="9" fontWeight="900" fill="#5C3D00" fontFamily="Arial">WARRANTY</text>
              <line x1="28" y1="47" x2="62" y2="47" stroke="#5C3D00" strokeWidth="0.8"/>
              <text x="45" y="55" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#5C3D00" fontFamily="Arial">SMART LIVING</text>
              <text x="45" y="63" textAnchor="middle" fontSize="6.5" fontWeight="800" fill="#5C3D00" fontFamily="Arial">PAKISTAN</text>
            </svg>
          </div>

          {/* Right: QR codes */}
          <div style={{ display:'flex', gap:12, alignItems:'flex-end', flexShrink:0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <InvoiceQR value={viewUrl + '?loc=warehouse'} size={52}/>
              <span style={{ fontSize:8, color:'#6B6A66', textAlign:'center', lineHeight:1.3 }}>Smart Living<br/>Pakistan Warehouse</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <InvoiceQR value="https://smartlivingpakistan.com/shop" size={52}/>
              <span style={{ fontSize:8, color:'#6B6A66', textAlign:'center', lineHeight:1.3 }}>Smart Living<br/>Pakistan Store</span>
            </div>
          </div>
        </div>

        {/* Website link - stuck to bottom */}
        <div style={{ marginTop:'auto', textAlign:'center', paddingBottom:12, paddingTop:8 }}>
          <a href="https://www.smartlivingpakistan.com" target="_blank" rel="noopener noreferrer"
            style={{ fontSize:11, color:'#1A2A7A', fontWeight:600, textDecoration:'underline' }}>
            www.Smartlivingpakistan.com
          </a>
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
