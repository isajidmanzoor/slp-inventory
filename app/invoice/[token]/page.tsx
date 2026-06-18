'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, AlertCircle, Printer, Download } from 'lucide-react'
import InvoiceDocument from '@/app/components/InvoiceDocument'
import type { Invoice, InvoiceItem } from '@/lib/supabase'

export default function PublicInvoicePage() {
  const params = useParams()
  const token = params?.token as string
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items,   setItems]   = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!token) return
    ;(async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data: inv, error: invErr } = await supabase
          .from('invoices').select('*').eq('public_token', token).maybeSingle()
        if (invErr) throw invErr
        if (!inv) { setError('Invoice not found. The link may be incorrect or expired.'); setLoading(false); return }

        const { data: its, error: itemsErr } = await supabase
          .from('invoice_items').select('*').eq('invoice_id', inv.id).order('sort_order')
        if (itemsErr) throw itemsErr

        setInvoice(inv)
        setItems(its || [])
      } catch {
        setError('Unable to load this invoice right now. Please try again later.')
      }
      setLoading(false)
    })()
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2" style={{ color:'#9C9B97' }}>
        <Loader2 size={20} className="animate-spin"/> Loading invoice…
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle size={36} style={{ color:'#9B2B2B' }}/>
        <p className="text-sm" style={{ color:'#6B6A66', maxWidth:320 }}>{error}</p>
      </div>
    )
  }

  const viewUrl = typeof window !== 'undefined' ? window.location.href : ''

  return (
    <div style={{ minHeight:'100vh', background:'#F5F4F0' }}>
      {/* Toolbar — hidden on print */}
      <div className="sticky top-0 z-20 bg-white border-b flex items-center justify-between px-4 py-3 print:hidden"
        style={{ borderColor:'#E4E2DC' }}>
        <div className="text-sm font-bold">🏬 Smart Living Pakistan</div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-semibold"
            style={{ borderColor:'#E4E2DC', color:'#3E3D3A' }}>
            <Printer size={13}/> Print
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold text-white"
            style={{ background:'#1A5FA8' }}>
            <Download size={13}/> Save as PDF
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8">
        <InvoiceDocument invoice={invoice} items={items} viewUrl={viewUrl}/>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
