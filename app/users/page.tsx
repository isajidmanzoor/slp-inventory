'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Trash2, RefreshCw, User, Mail, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react'

interface AppUser {
  id: string
  email: string
  full_name: string
  created_at: string
  last_sign_in_at: string | null
}

export default function UsersPage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState<{msg:string;type:'ok'|'err'}|null>(null)

  function showToast(msg: string, type: 'ok'|'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/auth'); return }
      setCurrentUserId(session.user.id)
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load users')
      setUsers(data)
    } catch (e: any) {
      showToast(e.message || 'Failed to load users', 'err')
    }
    setLoading(false)
  }, [router])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: deleteTarget.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Delete failed')
      showToast(`✅ ${deleteTarget.email} removed`)
      setUsers(prev => prev.filter(u => u.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'err')
    }
    setDeleting(false)
  }

  function fmtDate(d: string | null) {
    if (!d) return 'Never'
    return new Date(d).toLocaleDateString('en-PK', { day:'numeric', month:'short', year:'numeric' })
  }

  return (
    <div style={{ minHeight:'100vh', background:'#F5F4F0', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}>
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg pointer-events-none max-w-[90vw] text-center"
          style={{ transform:'translateX(-50%)', background:toast.type==='ok'?'#1C1B19':'#9B2B2B', color:'#fff', zIndex:9999 }}>
          {toast.msg}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.48)' }}
          onClick={e => { if (e.target===e.currentTarget && !deleting) setDeleteTarget(null) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background:'#FDEAEA' }}>
              <AlertCircle size={22} style={{ color:'#9B2B2B' }}/>
            </div>
            <h3 className="text-base font-bold mb-1">Delete Account?</h3>
            <p className="text-sm mb-1" style={{ color:'#1C1B19', fontWeight:600 }}>{deleteTarget.email}</p>
            <p className="text-sm mb-5" style={{ color:'#6B6A66' }}>This action is permanent and cannot be undone.</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="px-4 h-10 rounded-lg border text-sm font-medium" style={{ borderColor:'#E4E2DC', color:'#3E3D3A' }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 h-10 rounded-lg text-sm font-bold text-white flex items-center gap-2" style={{ background: deleting ? '#D88080' : '#9B2B2B' }}>
                {deleting && <RefreshCw size={13} className="animate-spin"/>}
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white border-b flex items-center gap-3 px-4 py-3" style={{ borderColor:'#E4E2DC' }}>
        <button onClick={() => router.push('/')} className="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
          style={{ borderColor:'#E4E2DC', color:'#6B6A66' }}><ArrowLeft size={16}/></button>
        <div>
          <div className="text-sm font-bold leading-tight">User Management</div>
          <div className="text-xs hidden sm:block" style={{ color:'#9C9B97' }}>{users.length} account{users.length===1?'':'s'}</div>
        </div>
        <button onClick={loadUsers} className="ml-auto w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0"
          style={{ borderColor:'#E4E2DC', color:'#6B6A66' }} title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/>
        </button>
      </header>

      <div className="max-w-screen-md mx-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2" style={{ color:'#9C9B97' }}>
            <RefreshCw size={18} className="animate-spin"/> Loading users…
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16" style={{ color:'#9C9B97' }}>No users found.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {users.map(u => (
              <div key={u.id} className="bg-white rounded-xl border p-3.5 sm:p-4 flex items-center gap-3" style={{ borderColor:'#E4E2DC' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:'#E8F1FB', color:'#1A5FA8' }}>
                  <User size={18}/>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate" style={{ color:'#1C1B19' }}>{u.full_name || 'Unnamed'}</span>
                    {u.id === currentUserId && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0" style={{ background:'#E3F5EE', color:'#0D6E4F' }}>You</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs mt-0.5 truncate" style={{ color:'#6B6A66' }}>
                    <Mail size={11} className="flex-shrink-0"/> <span className="truncate">{u.email}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] mt-1" style={{ color:'#9C9B97' }}>
                    <Calendar size={10} className="flex-shrink-0"/> Joined {fmtDate(u.created_at)} · Last seen {fmtDate(u.last_sign_in_at)}
                  </div>
                </div>
                <button
                  onClick={() => setDeleteTarget(u)}
                  className="w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0"
                  style={{ borderColor:'#F5C0C0', color:'#9B2B2B' }}
                  title="Delete account">
                  <Trash2 size={15}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
