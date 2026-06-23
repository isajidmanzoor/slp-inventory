'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Package, Search, Loader2, AlertCircle,
  ArrowLeft, Save, X,
} from 'lucide-react'
import type { Product, InvoiceItem } from '@/lib/supabase'
import { calcLineTotal, calcInvoiceTotals, fmtMoney, emptyItem } from '@/lib/invoice-utils'
import ProductPicker from '@/app/components/ProductPicker'

const inp = "w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white"
const label = "block text-xs font-semibold mb-1.5"

export default function NewInvoicePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [pickerIndex, setPickerIndex] = useState<number | null>(null)

  // ── form state ──
  const [orderId,        setOrderId]        = useState('')
  const [invoiceDate,    setInvoiceDate]    = useState(() => new Date().toISOString().slice(0,10))
  const [dueDate,        setDueDate]        = useState('')
  const [paymentStatus,  setPaymentStatus]  = useState<'Paid'|'Unpaid'|'Partial'|'Refunded'>('Unpaid')

  const [customerName,   setCustomerName]   = useState('')
  const [customerEmail,  setCustomerEmail]  = useState('')
  const [customerPhone,  setCustomerPhone]  = useState('')
  const [billingAddress, setBillingAddress] = useState('')
  const [shippingAddress,setShippingAddress]= useState('')
  const [sameAsShipping, setSameAsShipping] = useState(true)

  const [items, setItems] = useState<InvoiceItem[]>([emptyItem()])

  const [shippingCharges, setShippingCharges] = useState('0')
  const [deliveryTax,     setDeliveryTax]     = useState('0')
  const [extraDiscount,   setExtraDiscount]   = useState('0')
  const [currency,        setCurrency]        = useState('PKR') // always PKR

  const [paymentMethod, setPaymentMethod] = useState<'Card'|'Bank'|'COD'|'Wallet'|''>('')
  const [transactionId, setTransactionId] = useState('')
  const [paymentDate,   setPaymentDate]   = useState('')
  const [amountPaid,    setAmountPaid]    = useState('0')

  const [courierName,     setCourierName]     = useState('')
  const [trackingNumber,  setTrackingNumber]  = useState('')
  const [deliveryStatus,  setDeliveryStatus]  = useState('Pending')

  const [notes, setNotes] = useState('')

  useEffect(() => {
    ;(async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.auth.getSession()
      if (!data.session) { router.replace('/auth'); return }
      setAuthChecked(true)
    })()
  }, [router])

  // recalc each item's line_total whenever its inputs change
  const updateItem = useCallback((idx: number, patch: Partial<InvoiceItem>) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it
      const next = { ...it, ...patch }
      next.line_total = calcLineTotal(next)
      return next
    }))
  }, [])

  function addManualItem() {
    setItems(prev => [...prev, emptyItem()])
  }
  function removeItem(idx: number) {
    setItems(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))
  }
  function openPickerFor(idx: number) {
    setPickerIndex(idx)
    setShowPicker(true)
  }
  function handleProductSelected(p: Product) {
    if (pickerIndex === null) return
    updateItem(pickerIndex, {
      product_id: p.id,
      product_name: p.name,
      sku: String(p.id),
      unit_price: p.sale_price,
    })
    setShowPicker(false)
    setPickerIndex(null)
  }

  const totals = calcInvoiceTotals(
    items,
    parseFloat(shippingCharges) || 0,
    parseFloat(deliveryTax) || 0,
    parseFloat(extraDiscount) || 0,
  )

  async function handleSave() {
    setError('')
    if (!customerName.trim()) { setError('Customer name is required.'); return }
    const validItems = items.filter(it => it.product_name.trim())
    if (validItems.length === 0) { setError('Add at least one item with a name.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId || null,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          payment_status: paymentStatus,
          customer_name: customerName,
          customer_email: customerEmail || null,
          customer_phone: customerPhone || null,
          billing_address: billingAddress,
          shipping_address: sameAsShipping ? billingAddress : shippingAddress,
          items: validItems,
          shipping_charges: parseFloat(shippingCharges) || 0,
          delivery_tax: parseFloat(deliveryTax) || 0,
          extra_discount: parseFloat(extraDiscount) || 0,
          currency,
          payment_method: paymentMethod || null,
          transaction_id: transactionId || null,
          payment_date: paymentDate || null,
          amount_paid: parseFloat(amountPaid) || 0,
          courier_name: courierName || null,
          tracking_number: trackingNumber || null,
          delivery_status: deliveryStatus,
          notes: notes || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create invoice')
      router.push(`/invoices/${data.id}`)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setSaving(false)
    }
  }

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center gap-2" style={{ color:'#9C9B97' }}>
      <Loader2 size={18} className="animate-spin"/> Loading…
    </div>
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F5F4F0' }}>
      {showPicker && (
        <ProductPicker onSelect={handleProductSelected} onClose={() => setShowPicker(false)}/>
      )}

      <header className="sticky top-0 z-30 bg-white border-b flex items-center gap-3 px-4 py-3"
        style={{ borderColor:'#E4E2DC' }}>
        <button onClick={() => router.push('/invoices')}
          className="w-9 h-9 rounded-lg border flex items-center justify-center"
          style={{ borderColor:'#E4E2DC', color:'#6B6A66' }}>
          <ArrowLeft size={16}/>
        </button>
        <div className="text-sm font-bold">New Invoice</div>
        <button onClick={handleSave} disabled={saving}
          className="ml-auto flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-bold text-white"
          style={{ background: saving ? '#93C5FD' : '#1A5FA8' }}>
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
          {saving ? 'Saving…' : 'Save Invoice'}
        </button>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl text-sm"
            style={{ background:'#FEF2F2', color:'#B91C1C', border:'1px solid #FECACA' }}>
            <AlertCircle size={15} className="flex-shrink-0 mt-0.5"/>{error}
          </div>
        )}

        {/* ── BASIC INFO ── */}
        <Card title="Invoice Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Order ID">
              <input className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={orderId} onChange={e => setOrderId(e.target.value)} placeholder="ORD-1029"/>
            </Field>
            <Field label="Invoice Date">
              <input type="date" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}/>
            </Field>
            <Field label="Due Date">
              <input type="date" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={dueDate} onChange={e => setDueDate(e.target.value)}/>
            </Field>
            <Field label="Payment Status">
              <select className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as any)}>
                <option>Unpaid</option><option>Paid</option><option>Partial</option><option>Refunded</option>
              </select>
            </Field>
          </div>
        </Card>

        {/* ── CUSTOMER ── */}
        <Card title="Customer Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Customer Name *">
              <input className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Full name"/>
            </Field>
            <Field label="Email">
              <input type="email" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="customer@example.com"/>
            </Field>
            <Field label="Phone Number">
              <input type="tel" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+92 300 1234567"/>
            </Field>
            <div/>
            <Field label="Billing Address" full>
              <textarea className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} rows={2} value={billingAddress} onChange={e => setBillingAddress(e.target.value)} placeholder="Street, city, postal code"/>
            </Field>
            <Field label="Shipping Address" full>
              <label className="flex items-center gap-2 text-xs mb-1.5" style={{ color:'#6B6A66' }}>
                <input type="checkbox" checked={sameAsShipping} onChange={e => setSameAsShipping(e.target.checked)}/>
                Same as billing address
              </label>
              {!sameAsShipping && (
                <textarea className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} rows={2} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Street, city, postal code"/>
              )}
            </Field>
          </div>
        </Card>

        {/* ── ITEMS ── */}
        <Card title="Product Details">
          <div className="space-y-3">
            {items.map((it, idx) => (
              <div key={idx} className="p-3 rounded-xl border" style={{ borderColor:'#E4E2DC' }}>
                <div className="flex items-start gap-2 mb-2">
                  <button onClick={() => openPickerFor(idx)}
                    className="flex items-center gap-1.5 px-2.5 h-8 rounded-lg border text-xs font-semibold flex-shrink-0"
                    style={{ borderColor:'#B8D4F5', color:'#1A5FA8', background:'#E8F1FB' }}>
                    <Search size={12}/> Select
                  </button>
                  <input className={inp + " flex-1"} placeholder="Product name (or type manually)"
                    value={it.product_name}
                    onChange={e => updateItem(idx, { product_name: e.target.value })}/>
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)}
                      className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
                      style={{ borderColor:'#F5C0C0', color:'#9B2B2B' }}>
                      <Trash2 size={13}/>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <MiniField label="Qty">
                    <input type="number" min="0" step="1" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={it.quantity || ''}
                      onChange={e => updateItem(idx, { quantity: parseFloat(e.target.value) || 0 })}/>
                  </MiniField>
                  <MiniField label="Unit Price">
                    <input type="number" min="0" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={it.unit_price || ''}
                      onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })}/>
                  </MiniField>
                  <MiniField label="Discount">
                    <input type="number" min="0" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={it.discount || ''}
                      onChange={e => updateItem(idx, { discount: parseFloat(e.target.value) || 0 })}/>
                  </MiniField>
                  <MiniField label="Tax %">
                    <input type="number" min="0" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={it.tax_pct || ''}
                      onChange={e => updateItem(idx, { tax_pct: parseFloat(e.target.value) || 0 })}/>
                  </MiniField>
                </div>
                <div className="text-right text-sm font-bold mt-2">
                  Line Total: {fmtMoney(it.line_total, currency)}
                </div>
              </div>
            ))}
            <button onClick={addManualItem}
              className="w-full flex items-center justify-center gap-1.5 h-10 rounded-xl border-2 border-dashed text-sm font-semibold"
              style={{ borderColor:'#D3D1C7', color:'#6B6A66' }}>
              <Plus size={15}/> Add Item
            </button>
          </div>
        </Card>

        {/* ── PRICING SUMMARY ── */}
        <Card title="Pricing Summary">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <Field label="Shipping Charges">
              <input type="number" min="0" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={shippingCharges} onChange={e => setShippingCharges(e.target.value)}/>
            </Field>
            <Field label="Delivery Tax">
              <input type="number" min="0" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={deliveryTax} onChange={e => setDeliveryTax(e.target.value)}/>
            </Field>
            <Field label="Extra Discount">
              <input type="number" min="0" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={extraDiscount} onChange={e => setExtraDiscount(e.target.value)}/>
            </Field>
          </div>
          <div className="rounded-xl p-4 space-y-1.5" style={{ background:'#F5F4F0' }}>
            <SummaryRow label="Subtotal" value={fmtMoney(totals.subtotal, currency)}/>
            <SummaryRow label="Discount" value={`-${fmtMoney(totals.discountAmount, currency)}`}/>
            <SummaryRow label="Tax" value={fmtMoney(totals.taxAmount, currency)}/>
            <SummaryRow label="Shipping" value={fmtMoney(parseFloat(shippingCharges) || 0, currency)}/>
            <SummaryRow label="Delivery Tax" value={fmtMoney(parseFloat(deliveryTax) || 0, currency)}/>
            <div className="pt-2 mt-1 border-t flex justify-between items-baseline" style={{ borderColor:'#1A5FA8' }}>
              <span className="text-sm font-bold">Grand Total</span>
              <span className="text-xl font-extrabold" style={{ color:'#1A5FA8' }}>{fmtMoney(totals.grandTotal, currency)}</span>
            </div>
          </div>
        </Card>

        {/* ── PAYMENT INFO ── */}
        <Card title="Payment Information">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Payment Method">
              <select className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}>
                <option value="">Not specified</option>
                <option>Card</option><option>Bank</option><option>COD</option><option>Wallet</option>
              </select>
            </Field>
            <Field label="Transaction ID">
              <input className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={transactionId} onChange={e => setTransactionId(e.target.value)}/>
            </Field>
            <Field label="Payment Date">
              <input type="date" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={paymentDate} onChange={e => setPaymentDate(e.target.value)}/>
            </Field>
            <Field label="Amount Paid (partial OK)">
              <input type="number" min="0" className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={amountPaid} onChange={e => setAmountPaid(e.target.value)}/>
            </Field>
          </div>
        </Card>

        {/* ── SHIPPING ── */}
        <Card title="Shipping Details">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Courier Name">
              <input className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={courierName} onChange={e => setCourierName(e.target.value)} placeholder="TCS, Leopards, M&P…"/>
            </Field>
            <Field label="Tracking Number">
              <input className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)}/>
            </Field>
            <Field label="Delivery Status">
              <select className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value)}>
                <option>Pending</option><option>Shipped</option><option>Out for Delivery</option>
                <option>Delivered</option><option>Returned</option>
              </select>
            </Field>
          </div>
        </Card>

        {/* ── NOTES ── */}
        <Card title="Notes / Terms & Conditions">
          <textarea className={inp} style={{color:'#111827',background:'#fff',WebkitTextFillColor:'#111827'}} rows={3} value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="e.g. Goods once sold cannot be returned. Warranty void if seal broken."/>
        </Card>

        <div className="flex justify-end gap-2 pb-8">
          <button onClick={() => router.push('/invoices')}
            className="px-4 h-10 rounded-xl border text-sm font-medium"
            style={{ borderColor:'#E4E2DC', color:'#3E3D3A' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 h-10 rounded-xl text-sm font-bold text-white flex items-center gap-2"
            style={{ background: saving ? '#93C5FD' : '#1A5FA8' }}>
            {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>}
            {saving ? 'Saving…' : 'Save Invoice'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border p-4 sm:p-5" style={{ borderColor:'#E4E2DC' }}>
      <h3 className="text-sm font-bold mb-3">{title}</h3>
      {children}
    </div>
  )
}
function Field({ label: l, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className={label} style={{ color:'#3E3D3A' }}>{l}</label>
      {children}
    </div>
  )
}
function MiniField({ label: l, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold mb-1" style={{ color:'#9C9B97' }}>{l}</label>
      {children}
    </div>
  )
}
function SummaryRow({ label: l, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color:'#6B6A66' }}>{l}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
