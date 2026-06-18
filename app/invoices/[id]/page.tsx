'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Printer, Download, Mail, Link as LinkIcon,
  Loader2, AlertCircle, CheckCircle2, Copy, Check, X,
} from 'lucide-react'
import type { Invoice, InvoiceItem } from '@/lib/supabase'
import InvoiceDocument from '@/app/components/InvoiceDocument'
import { PAYMENT_STATUS_COLORS } from '@/lib/invoice-utils'

export default function InvoiceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  const [authChecked, setAuthChecked] = useState(false)
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [items,   setItems]   = useState<InvoiceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const [emailModal, setEmailModal]   = useState(false)
  const [emailTo,    setEmailTo]      = useState('')
  const [sending,    setSending]      = useState(false)
  const [emailMsg,   setEmailMsg]     = useState<{type:'ok'|'err'; text:string} | null>(null)
  const [copied,     setCopied]       = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data } = await supabase.auth.getSession()
      if (!data.session) { router.replace('/auth'); return }
      setAuthChecked(true)
    })()
  }, [router])

  const fetchInvoice = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch(`/api/invoices/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Invoice not found')
      setInvoice(data)
      setItems(data.items || [])
      setEmailTo(data.customer_email || '')
    } catch (e: any) {
      setError(e.message || 'Failed to load invoice')
    }
    setLoading(false)
  }, [id])

  useEffect(() => { if (authChecked && id) fetchInvoice() }, [authChecked, id, fetchInvoice])

  const viewUrl = invoice ? `${typeof window !== 'undefined' ? window.location.origin : ''}/invoice/${invoice.public_token}` : ''

  async function handleSendEmail() {
    setSending(true); setEmailMsg(null)
    try {
      const res = await fetch(`/api/invoices/${id}/email`, {
        method: 'POST', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ to: emailTo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      setEmailMsg({ type:'ok', text: `Invoice sent to ${data.sentTo}` })
    } catch (e: any) {
      setEmailMsg({ type:'err', text: e.message || 'Failed to send email' })
    }
    setSending(false)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(viewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  async function updateStatus(newStatus: string) {
    if (!invoice) return
    setStatusSaving(true)
    try {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH', headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ payment_status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setInvoice(data)
    } catch {}
    setStatusSaving(false)
  }

  if (!authChecked || loading) {
    return <div className="min-h-screen flex items-center justify-center gap-2" style={{ color:'#9C9B97' }}>
      <Loader2 size={18} className="animate-spin"/> Loading invoice…
    </div>
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle size={36} style={{ color:'#9B2B2B' }}/>
        <p className="text-sm" style={{ color:'#6B6A66' }}>{error || 'Invoice not found'}</p>
        <button onClick={() => router.push('/invoices')} className="text-sm font-semibold" style={{ color:'#1A5FA8' }}>
          Back to invoices
        </button>
      </div>
    )
  }

  const statusStyle = PAYMENT_STATUS_COLORS[invoice.payment_status] || { bg:'#F1EFE8', color:'#6B6A66' }

  return (
    <div style={{ minHeight:'100vh', background:'#F5F4F0' }}>
      {/* EMAIL MODAL */}
      {emailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" style={{ background:'rgba(0,0,0,0.48)' }}
          onClick={e => { if (e.target === e.currentTarget) setEmailModal(false) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">Email Invoice</h3>
              <button onClick={() => setEmailModal(false)} className="w-8 h-8 rounded-lg border flex items-center justify-center"
                style={{ borderColor:'#E4E2DC' }}><X size={15}/></button>
            </div>
            {emailMsg && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg mb-3 text-xs"
                style={{ background: emailMsg.type==='ok' ? '#F0FDF4' : '#FEF2F2',
                  color: emailMsg.type==='ok' ? '#166534' : '#B91C1C' }}>
                {emailMsg.type==='ok' ? <CheckCircle2 size={14}/> : <AlertCircle size={14}/>}
                {emailMsg.text}
              </div>
            )}
            <label className="block text-xs font-semibold mb-1.5" style={{ color:'#3E3D3A' }}>Send to</label>
            <input type="email" value={emailTo} onChange={e => setEmailTo(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:border-blue-500 mb-4"
              style={{ borderColor:'#E4E2DC', color:'#111827' }} placeholder="customer@example.com"/>
            <button onClick={handleSendEmail} disabled={sending || !emailTo}
              className="w-full h-10 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
              style={{ background: sending ? '#93C5FD' : '#1A5FA8' }}>
              {sending ? <Loader2 size={14} className="animate-spin"/> : <Mail size={14}/>}
              {sending ? 'Sending…' : 'Send Invoice'}
            </button>
          </div>
        </div>
      )}

      {/* TOOLBAR */}
      <header className="sticky top-0 z-30 bg-white border-b flex flex-wrap items-center gap-2 px-4 py-3 print:hidden"
        style={{ borderColor:'#E4E2DC' }}>
        <button onClick={() => router.push('/invoices')}
          className="w-9 h-9 rounded-lg border flex items-center justify-center"
          style={{ borderColor:'#E4E2DC', color:'#6B6A66' }}>
          <ArrowLeft size={16}/>
        </button>
        <div className="text-sm font-bold">{invoice.invoice_number}</div>

        <select value={invoice.payment_status} disabled={statusSaving}
          onChange={e => updateStatus(e.target.value)}
          className="h-8 px-2 rounded-lg border text-xs font-bold outline-none"
          style={{ borderColor: statusStyle.color, color: statusStyle.color, background: statusStyle.bg }}>
          <option>Unpaid</option><option>Paid</option><option>Partial</option><option>Refunded</option>
        </select>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-semibold"
            style={{ borderColor:'#E4E2DC', color:'#3E3D3A' }}>
            {copied ? <Check size={13} style={{ color:'#0D6E4F' }}/> : <LinkIcon size={13}/>}
            {copied ? 'Copied!' : 'Share Link'}
          </button>
          <button onClick={() => setEmailModal(true)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs font-semibold"
            style={{ borderColor:'#E4E2DC', color:'#3E3D3A' }}>
            <Mail size={13}/> Email
          </button>
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
      </header>

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
