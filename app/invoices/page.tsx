'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Search, Loader2, FileText, ArrowLeft, Trash2, Eye,
} from 'lucide-react'
import type { Invoice } from '@/lib/supabase'
import { fmtMoney, fmtDate, balanceDue, PAYMENT_STATUS_COLORS } from '@/lib/invoice-utils'

export default function InvoicesListPage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [query, setQuery]       = useState('')
  const [status, setStatus]     = useState('All')
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.auth.getSession()
      if (!data.session) { router.replace('/auth'); return }
      setAuthChecked(true)
    })()
  }, [router])

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status !== 'All') params.set('status', status)
      if (query) params.set('q', query)
      const res = await fetch(`/api/invoices?${params}`)
      const data = await res.json()
      setInvoices(Array.isArray(data) ? data : [])
    } catch { setInvoices([]) }
    setLoading(false)
  }, [status, query])

  useEffect(() => { if (authChecked) fetchInvoices() }, [authChecked, fetchInvoices])

  async function handleDelete() {
    if (!confirmId) return
    setDeleting(true)
    try {
      await fetch(`/api/invoices/${confirmId}`, { method: 'DELETE' })
      setConfirmId(null)
      fetchInvoices()
    } catch {}
    setDeleting(false)
  }

  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center gap-2" style={{ color:'#9C9B97' }}>
      <Loader2 size={18} className="animate-spin"/> Loading…
    </div>
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F5F4F0' }}>
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.48)' }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmId(null) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="text-4xl mb-2">🗑️</div>
            <h3 className="text-base font-bold mb-1">Delete Invoice?</h3>
            <p className="text-sm mb-5" style={{ color:'#6B6A66' }}>This cannot be undone.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setConfirmId(null)} className="px-4 h-9 rounded-lg border text-sm font-medium"
                style={{ borderColor:'#E4E2DC' }}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="px-4 h-9 rounded-lg text-sm font-bold text-white"
                style={{ background:'#9B2B2B' }}>{deleting ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white border-b flex items-center gap-3 px-4 py-3"
        style={{ borderColor:'#E4E2DC' }}>
        <button onClick={() => router.push('/')}
          className="w-9 h-9 rounded-lg border flex items-center justify-center"
          style={{ borderColor:'#E4E2DC', color:'#6B6A66' }}>
          <ArrowLeft size={16}/>
        </button>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0" style={{ background:'#E8F1FB' }}>🧾</div>
        <div className="text-sm font-bold">Invoices</div>
        <button onClick={() => router.push('/invoices/new')}
          className="ml-auto flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-bold text-white"
          style={{ background:'#1A5FA8' }}>
          <Plus size={15}/> New Invoice
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-4 sm:p-6">
        <div className="flex gap-2 mb-4 flex-wrap">
          <div className="relative flex-1" style={{ minWidth:180 }}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#9C9B97' }}/>
            <input type="search" placeholder="Search by invoice #, customer, order ID…"
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full h-9 pl-8 pr-3 rounded-lg border text-sm outline-none focus:border-blue-500"
              style={{ borderColor:'#E4E2DC', color:'#111827' }}/>
          </div>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="h-9 px-2 rounded-lg border text-sm outline-none"
            style={{ borderColor:'#E4E2DC', color:'#111827', minWidth:130 }}>
            <option>All</option><option>Paid</option><option>Unpaid</option><option>Partial</option><option>Refunded</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2" style={{ color:'#9C9B97' }}>
            <Loader2 size={18} className="animate-spin"/> Loading invoices…
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16" style={{ color:'#9C9B97' }}>
            <FileText size={44} className="mx-auto mb-3" style={{ opacity:0.3 }}/>
            <p className="mb-4">No invoices yet.</p>
            <button onClick={() => router.push('/invoices/new')}
              className="px-4 h-9 rounded-lg text-sm font-bold text-white inline-flex items-center gap-2"
              style={{ background:'#1A5FA8' }}>
              <Plus size={14}/> Create your first invoice
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden" style={{ borderColor:'#E4E2DC' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ minWidth: 640 }}>
                <thead style={{ background:'#F5F4F0' }}>
                  <tr>
                    {['Invoice #','Customer','Date','Total','Balance Due','Status','']
                      .map((h,i) => (
                      <th key={i} className="text-left font-bold py-2.5 px-3" style={{ fontSize:11, color:'#9C9B97' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const due = balanceDue(inv)
                    const st = PAYMENT_STATUS_COLORS[inv.payment_status] || { bg:'#F1EFE8', color:'#6B6A66' }
                    return (
                      <tr key={inv.id} className="border-b hover:bg-gray-50 cursor-pointer"
                        style={{ borderColor:'#F0EEE8' }}
                        onClick={() => router.push(`/invoices/${inv.id}`)}>
                        <td className="py-2.5 px-3 font-semibold">{inv.invoice_number}</td>
                        <td className="py-2.5 px-3">{inv.customer_name}</td>
                        <td className="py-2.5 px-3" style={{ color:'#6B6A66' }}>{fmtDate(inv.invoice_date)}</td>
                        <td className="py-2.5 px-3 font-semibold">{fmtMoney(inv.grand_total, inv.currency)}</td>
                        <td className="py-2.5 px-3" style={{ color: due > 0 ? '#9B2B2B' : '#0D6E4F' }}>{fmtMoney(due, inv.currency)}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background:st.bg, color:st.color }}>
                            {inv.payment_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right" onClick={e => e.stopPropagation()}>
                          <button onClick={() => router.push(`/invoices/${inv.id}`)}
                            className="w-8 h-8 rounded-lg border inline-flex items-center justify-center mr-1"
                            style={{ borderColor:'#E4E2DC' }}><Eye size={13}/></button>
                          <button onClick={() => setConfirmId(inv.id)}
                            className="w-8 h-8 rounded-lg border inline-flex items-center justify-center"
                            style={{ borderColor:'#F5C0C0', color:'#9B2B2B' }}><Trash2 size={13}/></button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
