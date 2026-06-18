import type { Invoice, InvoiceItem } from './supabase'

export function calcLineTotal(item: Pick<InvoiceItem, 'quantity'|'unit_price'|'discount'|'tax_pct'>): number {
  const base = item.quantity * item.unit_price
  const afterDiscount = base - item.discount
  const tax = afterDiscount * (item.tax_pct / 100)
  return Math.max(0, round2(afterDiscount + tax))
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function calcInvoiceTotals(items: InvoiceItem[], shippingCharges: number, deliveryTax: number, extraDiscount: number) {
  const subtotal = round2(items.reduce((s, it) => s + it.quantity * it.unit_price, 0))
  const itemDiscounts = round2(items.reduce((s, it) => s + it.discount, 0))
  const taxAmount = round2(items.reduce((s, it) => {
    const afterDiscount = it.quantity * it.unit_price - it.discount
    return s + afterDiscount * (it.tax_pct / 100)
  }, 0))
  const discountAmount = round2(itemDiscounts + extraDiscount)
  const grandTotal = round2(subtotal - discountAmount + taxAmount + shippingCharges + deliveryTax)
  return { subtotal, discountAmount, taxAmount, grandTotal }
}

export function fmtMoney(n: number, currency = 'PKR'): string {
  const symbol = currency === 'PKR' ? '₨' : currency + ' '
  return symbol + n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const PAYMENT_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Paid:      { bg: '#E3F5EE', color: '#0D6E4F' },
  Unpaid:    { bg: '#FDEAEA', color: '#9B2B2B' },
  Partial:   { bg: '#FDF0DC', color: '#8A4D0B' },
  Refunded:  { bg: '#EEEDFE', color: '#3C3489' },
}

export const DELIVERY_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Pending:           { bg: '#F1EFE8', color: '#6B6A66' },
  Shipped:           { bg: '#E8F1FB', color: '#1A5FA8' },
  'Out for Delivery':{ bg: '#FDF0DC', color: '#8A4D0B' },
  Delivered:         { bg: '#E3F5EE', color: '#0D6E4F' },
  Returned:          { bg: '#FDEAEA', color: '#9B2B2B' },
}

export function balanceDue(inv: Pick<Invoice, 'grand_total'|'amount_paid'>): number {
  return round2(Math.max(0, inv.grand_total - inv.amount_paid))
}

export function emptyItem(): InvoiceItem {
  return {
    product_id: null, product_name: '', sku: '',
    quantity: 1, unit_price: 0, discount: 0, tax_pct: 0, line_total: 0,
  }
}
