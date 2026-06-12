'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search, LayoutGrid, List, Plus, Pencil, Trash2,
  PackageX, AlertTriangle, CheckCircle2,
  X, Upload, RefreshCw, Package, Tag, DollarSign,
  LogOut, RefreshCcw, Wifi, WifiOff, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Product } from '@/lib/supabase'

const CAT: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  'Lights':       { emoji:'💡', color:'#0C447C', bg:'#E8F1FB', border:'#B8D4F5' },
  'Switch Plates':{ emoji:'🔌', color:'#3C3489', bg:'#EEEDFE', border:'#CECBF6' },
  'Smart Home':   { emoji:'🏠', color:'#085041', bg:'#E3F5EE', border:'#9FE1CB' },
  'Hardware':     { emoji:'🔧', color:'#712B13', bg:'#FAECE7', border:'#F5C4B3' },
  'Wall Decor':   { emoji:'🖼️', color:'#633806', bg:'#FDF0DC', border:'#FAC775' },
  'Gym':          { emoji:'🏋️', color:'#27500A', bg:'#EAF3DE', border:'#C0DD97' },
  'Home Decor':   { emoji:'🌿', color:'#72243E', bg:'#FBEAF0', border:'#F4C0D1' },
}
const cm = (c: string) => CAT[c] ?? { emoji:'📦', color:'#444', bg:'#F1EFE8', border:'#D3D1C7' }
const disc = (p: Product) =>
  p.original_price > 0 && p.sale_price > 0
    ? Math.round(((p.original_price - p.sale_price) / p.original_price) * 100)
    : 0
const fmt = (n: number) => n.toLocaleString('en-PK')
const LOW = 5, PER = 16

const EMPTY = {
  name:'', category:'', sub_category:'', sale_price:'',
  original_price:'', stock:'', notes:'', image_url:'',
}
const inp = `w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-all
  focus:border-blue-500 focus:ring-2 focus:ring-blue-100 bg-white`

export default function InventoryPage() {
  const router = useRouter()
  const [user,       setUser]       = useState<any>(null)
  const [authLoading,setAuthLoading]= useState(true)
  const [products,   setProducts]   = useState<Product[]>([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [syncing,    setSyncing]    = useState(false)
  const [syncResult, setSyncResult] = useState<string|null>(null)
  const [hasAutoSynced, setHasAutoSynced] = useState(false)
  const [view,       setView]       = useState<'grid'|'list'>('grid')
  const [activeCat,  setActiveCat]  = useState('All')
  const [activeStat, setActiveStat] = useState<'all'|'instock'|'value'|'lowstock'>('all')
  const [query,      setQuery]      = useState('')
  const [sortBy,     setSortBy]     = useState('default')
  const [page,       setPage]       = useState(1)
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(LOW)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileEmail, setProfileEmail] = useState('')
  const [modal,      setModal]      = useState<'add'|'edit'|null>(null)
  const [editProd,   setEditProd]   = useState<Product|null>(null)
  const [form,       setForm]       = useState({ ...EMPTY })
  const [imgPreview, setImgPreview] = useState<string|null>(null)
  const [confirmId,  setConfirmId]  = useState<number|null>(null)
  const [toast,      setToast]      = useState<{msg:string;type:'ok'|'err'}|null>(null)
  const [userMenu,   setUserMenu]   = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const imgDataRef = useRef<string|null>(null)

  // ── Auth check ────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/auth'); return }
      setUser(data.session.user)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) router.replace('/auth')
      else setUser(session.user)
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Fetch ─────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    let items: Product[] = []
    try {
      const res = await fetch('/api/products')
      const data = await res.json()
      items = Array.isArray(data) ? data : []
      setProducts(items)
    } catch {
      showToast('Failed to load products', 'err')
    } finally {
      setLoading(false)
    }
    return items
  }, [])

  useEffect(() => { if (!authLoading) fetchProducts() }, [authLoading, fetchProducts])

  useEffect(() => {
    if (!authLoading) fetchProfile()
  }, [authLoading])

  async function fetchProfile() {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('low_stock_threshold,email')
        .single()
      if (!error && data) {
        if (typeof data.low_stock_threshold === 'number') {
          setLowStockThreshold(data.low_stock_threshold)
        }
        if (typeof data.email === 'string') {
          setProfileEmail(data.email)
        }
      }
    } catch {
      // ignore profile load failure; use defaults
    }
    setProfileLoading(false)
  }

  useEffect(() => {
    if (authLoading || loading || hasAutoSynced) return
    if (products.length === 0) {
      setHasAutoSynced(true)
      if (process.env.NEXT_PUBLIC_SYNC_SECRET) {
        handleSync()
      } else {
        setSyncResult('🔧 Configure NEXT_PUBLIC_SYNC_SECRET + WooCommerce keys for auto-sync')
      }
    }
  }, [authLoading, loading, products.length, hasAutoSynced])

  // Real-time
  useEffect(() => {
    if (authLoading) return
    let channel: any
    import('@/lib/supabase').then(({ supabase: sb }) => {
      channel = sb
        .channel('products-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, fetchProducts)
        .subscribe()
    })
    return () => { channel?.unsubscribe() }
  }, [authLoading, fetchProducts])

  // ── WooCommerce sync ──────────────────────────────
  async function handleSync() {
    setSyncing(true); setSyncResult(null)
    const syncSecret = process.env.NEXT_PUBLIC_SYNC_SECRET || ''
    if (!syncSecret) {
      setSyncResult('⚠️ NEXT_PUBLIC_SYNC_SECRET is not configured. Trying sync without client-side auth...')
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (syncSecret) {
        headers.Authorization = `Bearer ${syncSecret}`
      }

      const res = await fetch('/api/sync', {
        method: 'POST',
        headers,
      })
      const data = await res.json()
      if (data.ok) {
        setSyncResult(`✅ Synced! +${data.added} new, ${data.updated} updated (${data.total} total)`)
        const latestProducts = await fetchProducts()
        await sendLowStockEmail(latestProducts)
      } else if (data.error?.includes('API keys not configured')) {
        setSyncResult('⚙️ Add WOO_CONSUMER_KEY & WOO_CONSUMER_SECRET in Vercel env vars to enable sync')
      } else if (data.error?.includes('Unauthorized')) {
        setSyncResult('❌ Sync failed: authorization failed. Ensure SYNC_SECRET and NEXT_PUBLIC_SYNC_SECRET match in Vercel env vars.')
      } else {
        setSyncResult('❌ Sync failed: ' + (data.error || 'Unknown error'))
      }
    } catch {
      setSyncResult('❌ Could not reach server')
    }
    setSyncing(false)
    setTimeout(() => setSyncResult(null), 6000)
  }

  // ── Sign out ──────────────────────────────────────
  async function handleSignOut() {
    await supabase.auth.signOut()
    router.replace('/auth')
  }

  function showToast(msg: string, type: 'ok'|'err' = 'ok') {
    setToast({ msg, type }); setTimeout(() => setToast(null), 2800)
  }

  async function sendLowStockEmail(products: Product[]) {
    if (!profileEmail) return
    const lowProducts = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold)
    if (lowProducts.length === 0) return

    try {
      await fetch('/api/notify-low-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profileEmail, threshold: lowStockThreshold, products: lowProducts }),
      })
    } catch {
      // ignore notification failure; only show data in app
    }
  }

  async function handleSaveProfile() {
    if (!user?.id) return
    if (!profileEmail.trim()) {
      showToast('Enter an email to receive alerts', 'err')
      return
    }
    setProfileSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: profileEmail.trim(),
          low_stock_threshold: lowStockThreshold,
        }, { onConflict: 'id' })
      if (error) throw new Error(error.message)
      showToast('✅ Alert settings saved')
    } catch (e: any) {
      showToast(e.message || 'Save failed', 'err')
    }
    setProfileSaving(false)
  }

  // ── Filter/sort/paginate ──────────────────────────
  const filtered = () => {
    const q = query.toLowerCase()
    let r = products.filter(p => {
      const inCat = activeCat === 'All' || p.category === activeCat
      const inQ   = !q || [p.name, p.category, p.sub_category, p.notes]
                        .some(x => x?.toLowerCase().includes(q))
      
      // Apply stat filters
      let inStat = true
      if (activeStat === 'instock') inStat = p.stock > 0
      else if (activeStat === 'value') inStat = p.sale_price * p.stock > 0
      else if (activeStat === 'lowstock') inStat = p.stock === 0 || (p.stock > 0 && p.stock <= lowStockThreshold)
      
      return inCat && inQ && inStat
    })
    
    // Auto-sort when stock value is selected
    if (activeStat === 'value') {
      r.sort((a,b) => (b.sale_price * b.stock) - (a.sale_price * a.stock))
    } else {
      switch (sortBy) {
        case 'az': r.sort((a,b) => a.name.localeCompare(b.name)); break
        case 'za': r.sort((a,b) => b.name.localeCompare(a.name)); break
        case 'pa': r.sort((a,b) => a.sale_price - b.sale_price); break
        case 'pd': r.sort((a,b) => b.sale_price - a.sale_price); break
        case 'dc': r.sort((a,b) => disc(b) - disc(a)); break
        case 'ls': r.sort((a,b) => a.stock - b.stock); break
      }
    }
    return r
  }

  const data       = filtered()
  const totalPages = Math.max(1, Math.ceil(data.length / PER))
  const curPage    = Math.min(page, totalPages)
  const pageData   = data.slice((curPage - 1) * PER, curPage * PER)

  const totalStock = products.reduce((s,p) => s + p.stock, 0)
  const stockValue = products.reduce((s,p) => s + p.sale_price * p.stock, 0)
  const lowCount   = products.filter(p => p.stock > 0 && p.stock <= lowStockThreshold).length
  const outCount   = products.filter(p => p.stock === 0).length
  const valStr     = stockValue >= 1_000_000 ? (stockValue/1_000_000).toFixed(1)+'M'
                   : stockValue >= 1000       ? (stockValue/1000).toFixed(0)+'K'
                   : String(stockValue)

  // ── Modal helpers ─────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY }); setImgPreview(null)
    imgDataRef.current = null; setEditProd(null); setModal('add')
  }
  function openEdit(p: Product) {
    setForm({
      name: p.name, category: p.category, sub_category: p.sub_category,
      sale_price: String(p.sale_price), original_price: String(p.original_price),
      stock: String(p.stock), notes: p.notes, image_url: p.image_url ?? '',
    })
    setImgPreview(p.image_url ?? null)
    imgDataRef.current = null; setEditProd(p); setModal('edit')
  }
  function closeModal() { setModal(null); setEditProd(null); imgDataRef.current = null }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const data = ev.target?.result as string
      imgDataRef.current = data
      setImgPreview(data)
      setForm(f => ({ ...f, image_url: '' }))
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    if (!form.name.trim())  { showToast('Product name is required', 'err'); return }
    if (!form.category)     { showToast('Please select a category', 'err'); return }
    const stockNum = parseInt(form.stock)
    if (form.stock !== '' && (isNaN(stockNum) || stockNum < 0)) {
      showToast('Stock must be a non-negative number', 'err'); return
    }
    setSaving(true)
    const finalUrl = imgDataRef.current ?? form.image_url ?? null
    const payload = {
      name:           form.name.trim(),
      category:       form.category,
      sub_category:   form.sub_category.trim(),
      sale_price:     parseFloat(form.sale_price)     || 0,
      original_price: parseFloat(form.original_price) || 0,
      stock:          parseInt(form.stock)            || 0,
      notes:          form.notes.trim(),
      image_url:      finalUrl,
    }
    try {
      if (modal === 'edit' && editProd) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editProd.id)
          .select()
          .single()
        if (error) throw new Error(error.message)
        showToast('✅ Product updated')
      } else {
        const { error } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single()
        if (error) throw new Error(error.message)
        showToast('✅ Product added')
      }
      closeModal()
      const latestProducts = await fetchProducts()
      await sendLowStockEmail(latestProducts)
    } catch (e: any) { showToast(e.message || 'Save failed', 'err') }
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirmId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', confirmId)
      if (error) throw new Error(error.message)
      showToast('✅ Product deleted')
      setConfirmId(null)
      await fetchProducts()
    } catch (e: any) {
      showToast(e.message || 'Delete failed', 'err')
    }
    setSaving(false)
  }

  function StockBadge({ stock }: { stock: number }) {
    if (stock === 0) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
        style={{ background:'#FDEAEA', color:'#9B2B2B' }}>
        <PackageX size={11}/> Out of stock
      </span>
    )
    if (stock <= lowStockThreshold) return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
        style={{ background:'#FDF0DC', color:'#8A4D0B' }}>
        <AlertTriangle size={11}/> Low: {stock}
      </span>
    )
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
        style={{ background:'#E3F5EE', color:'#0D6E4F' }}>
        <CheckCircle2 size={11}/> {stock} in stock
      </span>
    )
  }

  function ProdImg({ p, h }: { p: Product; h: number }) {
    const [err, setErr] = useState(false)
    const m = cm(p.category)
    
    // Only show image if URL exists and is valid
    const hasValidUrl = p.image_url && p.image_url.trim().length > 0 && p.image_url.startsWith('http')
    
    if (!hasValidUrl || err) return (
      <div style={{ height:h, background:m.bg, display:'flex', alignItems:'center',
        justifyContent:'center', fontSize: h > 80 ? 42 : 22 }}>{m.emoji}</div>
    )
    return <img 
      src={p.image_url || ''} 
      alt={p.name} 
      loading="lazy"
      onError={() => setErr(true)}
      style={{ width:'100%', height:h, objectFit:'cover', display:'block' }} 
    />
  }

  if (authLoading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'#F5F4F0', fontFamily:'-apple-system,sans-serif' }}>
      <div style={{ display:'flex', gap:10, alignItems:'center', color:'#9C9B97' }}>
        <RefreshCw size={20} className="animate-spin"/> Loading…
      </div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#F5F4F0', fontFamily:'-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif' }}
      onClick={() => userMenu && setUserMenu(false)}>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg pointer-events-none"
          style={{ transform:'translateX(-50%)',
            background: toast.type==='ok' ? '#1C1B19' : '#9B2B2B', color:'#fff', zIndex:9999 }}>
          {toast.msg}
        </div>
      )}

      {/* SYNC RESULT BANNER */}
      {syncResult && (
        <div className="fixed top-16 left-1/2 z-40 px-4 py-2 rounded-xl text-sm font-medium shadow-lg"
          style={{ transform:'translateX(-50%)', background:'white', border:'1px solid #E4E2DC',
            color:'#1C1B19', maxWidth:'90vw', textAlign:'center' }}>
          {syncResult}
        </div>
      )}

      {/* CONFIRM DELETE */}
      {confirmId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
          style={{ background:'rgba(0,0,0,0.48)' }}
          onClick={e => { if (e.target===e.currentTarget) setConfirmId(null) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl">
            <div className="text-4xl mb-2">🗑️</div>
            <h3 className="text-base font-bold mb-1">Delete Product?</h3>
            <p className="text-sm mb-5" style={{ color:'#6B6A66' }}>
              {products.find(p=>p.id===confirmId)?.name} will be permanently removed.
            </p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => setConfirmId(null)}
                className="px-4 h-9 rounded-lg border text-sm font-medium"
                style={{ borderColor:'#E4E2DC', color:'#3E3D3A' }}>Cancel</button>
              <button onClick={handleDelete}
                className="px-4 h-9 rounded-lg text-sm font-bold text-white"
                style={{ background:'#9B2B2B' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background:'rgba(0,0,0,0.48)' }}
          onClick={e => { if (e.target===e.currentTarget) closeModal() }}>
          <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight:'94vh' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold">{modal==='add' ? 'Add New Product' : 'Edit Product'}</h2>
              <button onClick={closeModal}
                className="w-8 h-8 rounded-lg border flex items-center justify-center"
                style={{ borderColor:'#E4E2DC', color:'#6B6A66' }}><X size={16}/></button>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* image */}
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color:'#3E3D3A' }}>Product Image</label>
                <div className="flex gap-3 items-start">
                  <div className="w-20 h-20 rounded-xl border overflow-hidden flex-shrink-0 flex items-center justify-center"
                    style={{ borderColor:'#E4E2DC', background:'#F5F4F0', fontSize:32 }}>
                    {imgPreview
                      ? <img src={imgPreview} className="w-full h-full object-cover"
                          onError={() => setImgPreview(null)} alt="preview"/>
                      : (cm(form.category).emoji || '📦')}
                  </div>
                  <div className="flex-1 space-y-2">
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile}/>
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="w-full h-9 rounded-lg border text-xs flex items-center justify-center gap-2"
                      style={{ borderColor:'#E4E2DC', background:'#F5F4F0', color:'#3E3D3A' }}>
                      <Upload size={13}/> Upload from device
                    </button>
                    <input type="url" placeholder="Or paste image URL…"
                      value={imgDataRef.current ? '' : form.image_url}
                      onChange={e => {
                        imgDataRef.current = null
                        setForm(f => ({ ...f, image_url: e.target.value }))
                        setImgPreview(e.target.value || null)
                      }}
                      className={inp} style={{ borderColor:'#E4E2DC' }}/>
                  </div>
                </div>
              </div>

              {/* name */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color:'#3E3D3A' }}>
                  Product Name <span style={{ color:'#9B2B2B' }}>*</span>
                </label>
                <input type="text" placeholder="Full product name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inp} style={{ borderColor:'#E4E2DC' }}/>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color:'#3E3D3A' }}>
                    Category <span style={{ color:'#9B2B2B' }}>*</span>
                  </label>
                  <select value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className={inp} style={{ borderColor:'#E4E2DC' }}>
                    <option value="">Select…</option>
                    {Object.keys(CAT).map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color:'#3E3D3A' }}>Sub-Category</label>
                  <input type="text" placeholder="e.g. Ceiling Lights" value={form.sub_category}
                    onChange={e => setForm(f => ({ ...f, sub_category: e.target.value }))}
                    className={inp} style={{ borderColor:'#E4E2DC' }}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color:'#3E3D3A' }}>Sale Price (PKR)</label>
                  <input type="number" placeholder="0" min="0" value={form.sale_price}
                    onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))}
                    className={inp} style={{ borderColor:'#E4E2DC' }}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color:'#3E3D3A' }}>Original / MRP (PKR)</label>
                  <input type="number" placeholder="0" min="0" value={form.original_price}
                    onChange={e => setForm(f => ({ ...f, original_price: e.target.value }))}
                    className={inp} style={{ borderColor:'#E4E2DC' }}/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1" style={{ color:'#3E3D3A' }}>
                    Stock Quantity <span style={{ color:'#9B2B2B' }}>*</span>
                  </label>
                  <input type="number" placeholder="0" min="0" value={form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    className={inp} style={{ borderColor:'#E4E2DC' }}/>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold mb-1" style={{ color:'#3E3D3A' }}>Notes / Details</label>
                  <textarea placeholder="SKU, specs, variants…" rows={2} value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className={inp} style={{ borderColor:'#E4E2DC', resize:'none' }}/>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t flex justify-end gap-2 bg-white sticky bottom-0">
              <button onClick={closeModal}
                className="px-4 h-9 rounded-lg border text-sm font-medium"
                style={{ borderColor:'#E4E2DC', color:'#3E3D3A' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 h-9 rounded-lg text-sm font-bold text-white flex items-center gap-2"
                style={{ background: saving ? '#7FA8D0' : '#1A5FA8' }}>
                {saving && <RefreshCw size={13} className="animate-spin"/>}
                {saving ? 'Saving…' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-white border-b flex items-center gap-3 px-4 py-3"
        style={{ borderColor:'#E4E2DC' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
          style={{ background:'#E8F1FB' }}>🏬</div>
        <div>
          <div className="text-sm font-bold leading-tight">Smart Living Pakistan</div>
          <div className="text-xs hidden sm:block" style={{ color:'#9C9B97' }}>Inventory Management</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* Sync button */}
          <button onClick={handleSync} disabled={syncing}
            className="hidden sm:flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-semibold"
            style={{ borderColor:'#E4E2DC', color: syncing ? '#9C9B97' : '#085041',
              background: syncing ? '#F5F4F0' : '#E3F5EE' }}
            title="Sync from smartlivingpakistan.com">
            {syncing ? <RefreshCw size={13} className="animate-spin"/> : <RefreshCcw size={13}/>}
            {syncing ? 'Syncing…' : 'Sync Store'}
          </button>
          <button onClick={fetchProducts}
            className="w-8 h-8 rounded-lg border flex items-center justify-center"
            style={{ borderColor:'#E4E2DC', color:'#6B6A66' }} title="Refresh">
            <RefreshCw size={14}/>
          </button>
          <div className="flex border rounded-lg overflow-hidden" style={{ borderColor:'#E4E2DC' }}>
            {(['grid','list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="w-8 h-8 flex items-center justify-center"
                style={{ background: view===v ? '#E8F1FB' : 'white',
                         color: view===v ? '#1A5FA8' : '#9C9B97' }}>
                {v==='grid' ? <LayoutGrid size={14}/> : <List size={14}/>}
              </button>
            ))}
          </div>
          <button onClick={openAdd}
            className="flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-bold text-white"
            style={{ background:'#1A5FA8' }}>
            <Plus size={15}/> <span className="hidden sm:inline">Add Product</span>
          </button>
          {/* User menu */}
          <div style={{ position:'relative' }}>
            <button onClick={e => { e.stopPropagation(); setUserMenu(u => !u) }}
              className="w-9 h-9 rounded-full border flex items-center justify-center"
              style={{ borderColor:'#E4E2DC', background:'#E8F1FB', color:'#1A5FA8' }}>
              <User size={16}/>
            </button>
            {userMenu && (
              <div className="absolute right-0 top-10 bg-white border rounded-xl shadow-xl z-50 w-48 overflow-hidden"
                style={{ borderColor:'#E4E2DC' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-3 py-2.5 border-b" style={{ borderColor:'#F0EEE8' }}>
                  <div className="text-xs font-semibold truncate">{user?.email || user?.phone}</div>
                  <div className="text-[11px] mt-0.5" style={{ color:'#9C9B97' }}>
                    {user?.user_metadata?.full_name || 'Staff'}
                  </div>
                </div>
                <button onClick={handleSync} disabled={syncing}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-gray-50"
                  style={{ color:'#085041' }}>
                  {syncing ? <RefreshCw size={13} className="animate-spin"/> : <RefreshCcw size={13}/>}
                  {syncing ? 'Syncing store…' : 'Sync from Store'}
                </button>
                <button onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-xs hover:bg-red-50"
                  style={{ color:'#9B2B2B' }}>
                  <LogOut size={13}/> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-4">
        {/* ALERT SETTINGS */}
        <div className="bg-white rounded-3xl border p-4 sm:p-5 shadow-sm mb-4"
          style={{ borderColor:'#E4E2DC' }}>
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold" style={{ color:'#1C1B19' }}>Low stock alert settings</div>
              <div className="text-xs mt-1" style={{ color:'#6B6A66' }}>
                Get alerted inside the app and by email when stock falls below your limit.
              </div>
            </div>
            <button onClick={handleSaveProfile}
              disabled={profileSaving}
              className="h-9 px-4 rounded-lg text-sm font-semibold text-white"
              style={{ background: profileSaving ? '#7FA8D0' : '#1A5FA8' }}>
              {profileSaving ? 'Saving…' : 'Save alert settings'}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <label className="text-xs font-semibold text-slate-700">
              Notification email
              <input type="email" value={profileEmail}
                onChange={e => setProfileEmail(e.target.value)}
                className="mt-2 w-full h-10 px-3 rounded-xl border text-sm outline-none"
                style={{ borderColor:'#E4E2DC' }}
                placeholder="you@example.com" />
            </label>
            <label className="text-xs font-semibold text-slate-700">
              Low stock threshold
              <input type="number" min={1} value={lowStockThreshold}
                onChange={e => setLowStockThreshold(parseInt(e.target.value) || 1)}
                className="mt-2 w-full h-10 px-3 rounded-xl border text-sm outline-none"
                style={{ borderColor:'#E4E2DC' }}
                placeholder="5" />
            </label>
            <div className="text-xs text-slate-600 leading-relaxed">
              Your current alert threshold is <strong>{lowStockThreshold}</strong>. Products with stock at or below this value will be marked low stock and included in email alerts.
            </div>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4">
          {[
            { id: 'all' as const, icon:<Package size={18}/>, label:'Products',      val: products.length,   bg:'#E8F1FB', color:'#0C447C' },
            { id: 'instock' as const, icon:<Tag size={18}/>,     label:'Units in Stock', val: fmt(totalStock),  bg:'#E3F5EE', color:'#085041' },
            { id: 'value' as const, icon:<DollarSign size={18}/>, label:'Stock Value', val: '₨'+valStr,       bg:'#FDF0DC', color:'#633806' },
            { id: 'lowstock' as const, icon: lowCount+outCount > 0 ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>,
              label:'Low / Out of Stock', val: lowCount+outCount,
              bg: lowCount+outCount > 0 ? '#FDEAEA' : '#E3F5EE',
              color: lowCount+outCount > 0 ? '#9B2B2B' : '#085041' },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveStat(s.id)
                setPage(1)
              }}
              className="bg-white rounded-xl border flex items-center gap-3 px-3 py-3 transition-all text-left hover:shadow-md"
              style={{
                borderColor: activeStat === s.id ? s.color : '#E4E2DC',
                borderWidth: activeStat === s.id ? 2 : 1,
                background: activeStat === s.id ? s.bg : 'white',
              }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background:s.bg, color:s.color }}>{s.icon}</div>
              <div>
                <div className="text-lg font-bold leading-none" style={{ color:'#1C1B19' }}>{s.val}</div>
                <div className="text-[11px] mt-0.5" style={{ color:'#9C9B97' }}>{s.label}</div>
              </div>
            </button>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="flex gap-2 pt-3 flex-wrap">
          <div className="relative flex-1" style={{ minWidth:140 }}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color:'#9C9B97' }}/>
            <input type="search" placeholder="Search products…" value={query}
              onChange={e => { setQuery(e.target.value); setPage(1) }}
              className="w-full h-9 pl-8 pr-3 rounded-lg border text-sm focus:outline-none focus:border-blue-500"
              style={{ borderColor:'#E4E2DC', background:'white', color:'#1C1B19' }}/>
          </div>
          <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}
            className="h-9 px-2 rounded-lg border text-sm focus:outline-none"
            style={{ borderColor:'#E4E2DC', background:'white', color:'#1C1B19', minWidth:140 }}>
            <option value="default">Sort: Default</option>
            <option value="az">Name A → Z</option>
            <option value="za">Name Z → A</option>
            <option value="pa">Price: Low → High</option>
            <option value="pd">Price: High → Low</option>
            <option value="dc">Highest Discount</option>
            <option value="ls">Low Stock First</option>
          </select>
        </div>

        {/* LOW STOCK ALERT */}
        {(lowCount + outCount > 0) && (
          <div className="rounded-3xl border bg-[#FFF5F5] p-4 mb-4" style={{ borderColor:'#F5C0C0' }}>
            <div className="text-sm font-bold" style={{ color:'#9B2B2B' }}>
              {lowCount + outCount} product{lowCount + outCount === 1 ? '' : 's'} low or out of stock
            </div>
            <div className="text-xs mt-1" style={{ color:'#6B6A66' }}>
              Save your alert settings below to receive automatic email notifications when stock is low.
            </div>
          </div>
        )}

        {/* TABS */}
        <div className="flex gap-1.5 pt-3 pb-1 overflow-x-auto no-scrollbar">
          {['All', ...Object.keys(CAT)].map(c => {
            const n  = c==='All' ? products.length : products.filter(p=>p.category===c).length
            const m  = CAT[c]; const on = activeCat === c
            return (
              <button key={c} onClick={() => { setActiveCat(c); setPage(1) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold flex-shrink-0 border"
                style={{
                  background: on ? (m?.bg ?? '#E8F1FB') : 'white',
                  color:      on ? (m?.color ?? '#1A5FA8') : '#6B6A66',
                  borderColor: on ? (m?.border ?? '#B8D4F5') : '#E4E2DC',
                  borderWidth: on ? 1.5 : 1,
                }}>
                {m?.emoji ?? '🗂️'} {c}
                <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background:'rgba(0,0,0,.07)' }}>{n}</span>
              </button>
            )
          })}
        </div>

        {/* PRODUCTS */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-2" style={{ color:'#9C9B97' }}>
            <RefreshCw size={18} className="animate-spin"/> Loading inventory…
          </div>
        ) : pageData.length === 0 ? (
          <div className="text-center py-16" style={{ color:'#9C9B97' }}>
            <div className="text-5xl mb-3">🔍</div>
            <p>No products found. Try a different search or category.</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid gap-2.5 pt-3"
            style={{ gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))' }}>
            {pageData.map(p => {
              const m = cm(p.category); const d = disc(p)
              return (
                <div key={p.id}
                  className="bg-white rounded-xl border overflow-hidden flex flex-col group"
                  style={{ borderColor: p.stock === 0 ? '#F5C0C0' : p.stock <= lowStockThreshold ? '#F5C675' : '#E4E2DC' }}>
                  <div className="relative overflow-hidden" style={{ height:145 }}>
                    <ProdImg p={p} h={145}/>
                    {d > 0 && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                        style={{ background:'#1A5FA8' }}>-{d}%</div>
                    )}
                    {(p as any).woo_id && (
                      <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                        title="Synced from WooCommerce"
                        style={{ background:'rgba(8,80,65,0.85)' }}>
                        <Wifi size={10} color="white"/>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(p)}
                        className="w-7 h-7 rounded-md bg-white border flex items-center justify-center"
                        style={{ borderColor:'#E4E2DC' }}>
                        <Pencil size={12}/>
                      </button>
                      <button onClick={() => setConfirmId(p.id)}
                        className="w-7 h-7 rounded-md bg-white border flex items-center justify-center"
                        style={{ borderColor:'#F5C0C0' }}>
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                  <div className="p-2.5 flex flex-col gap-1.5 flex-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit"
                      style={{ background:m.bg, color:m.color, borderColor:m.border }}>
                      {m.emoji} {p.category}
                    </span>
                    <div className="text-xs font-semibold leading-snug" style={{ color:'#1C1B19' }}>{p.name}</div>
                    {p.sub_category && <div className="text-[11px]" style={{ color:'#9C9B97' }}>{p.sub_category}</div>}
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      {p.sale_price > 0
                        ? <span className="text-sm font-bold">₨{fmt(p.sale_price)}</span>
                        : <span className="text-xs italic" style={{ color:'#9C9B97' }}>Price TBD</span>}
                      {p.original_price > 0 && (
                        <span className="text-[11px] line-through" style={{ color:'#B4B2A9' }}>₨{fmt(p.original_price)}</span>
                      )}
                    </div>
                    <div className="border-t pt-1.5 mt-auto" style={{ borderColor:'#F0EEE8' }}>
                      <StockBadge stock={p.stock}/>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="pt-3 overflow-x-auto">
            <table className="w-full bg-white rounded-xl border overflow-hidden text-sm"
              style={{ borderColor:'#E4E2DC', minWidth:620 }}>
              <thead style={{ background:'#F5F4F0' }}>
                <tr>{['', 'Product','Category','Sale Price','Disc','Stock','Actions'].map((h,i) => (
                  <th key={i} className="px-3 py-2.5 text-left text-[11px] font-bold border-b"
                    style={{ color:'#9C9B97', borderColor:'#E4E2DC',
                      width: i===0?52:i===6?90:'auto', textAlign: i>=4?'center':'left' }}>
                    {h}
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {pageData.map(p => {
                  const m = cm(p.category); const d = disc(p)
                  return (
                    <tr key={p.id} className="border-b hover:bg-gray-50" style={{ borderColor:'#F0EEE8' }}>
                      <td className="px-3 py-2">
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center"
                          style={{ background:m.bg, fontSize:18 }}>
                          <ProdImg p={p} h={40}/>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-xs leading-snug flex items-center gap-1">
                          {p.name}
                          {(p as any).woo_id && <Wifi size={10} color="#085041" aria-label="Synced"/>}
                        </div>
                        {p.sub_category && <div className="text-[11px]" style={{ color:'#9C9B97' }}>{p.sub_category}</div>}
                        {p.notes && <div className="text-[11px]" style={{ color:'#9C9B97' }}>{p.notes}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
                          style={{ background:m.bg, color:m.color, borderColor:m.border }}>
                          {m.emoji} {p.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-xs whitespace-nowrap">
                        {p.sale_price > 0 ? `₨${fmt(p.sale_price)}` : '—'}
                        {p.original_price > 0 && (
                          <div className="text-[11px] font-normal line-through" style={{ color:'#B4B2A9' }}>
                            ₨{fmt(p.original_price)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {d > 0
                          ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                              style={{ background:'#E8F1FB', color:'#1A5FA8' }}>-{d}%</span>
                          : '—'}
                      </td>
                      <td className="px-3 py-2"><StockBadge stock={p.stock}/></td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => openEdit(p)}
                          className="w-7 h-7 rounded-md border inline-flex items-center justify-center mr-1"
                          style={{ borderColor:'#E4E2DC' }}><Pencil size={11}/></button>
                        <button onClick={() => setConfirmId(p.id)}
                          className="w-7 h-7 rounded-md border inline-flex items-center justify-center"
                          style={{ borderColor:'#F5C0C0' }}><Trash2 size={11}/></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        {!loading && data.length > PER && (
          <div className="flex items-center justify-between py-4 flex-wrap gap-2">
            <span className="text-xs" style={{ color:'#9C9B97' }}>
              Showing {(curPage-1)*PER+1}–{Math.min(curPage*PER,data.length)} of {data.length}
            </span>
            <div className="flex gap-1.5">
              <button disabled={curPage<=1} onClick={() => setPage(p=>p-1)}
                className="w-8 h-8 rounded-lg border text-sm disabled:opacity-30"
                style={{ borderColor:'#E4E2DC', background:'white' }}>‹</button>
              {Array.from({length:totalPages},(_,i)=>i+1)
                .filter(n => Math.abs(n-curPage)<=2)
                .map(n => (
                  <button key={n} onClick={() => setPage(n)}
                    className="w-8 h-8 rounded-lg border text-xs font-medium"
                    style={{
                      borderColor: n===curPage ? '#B8D4F5' : '#E4E2DC',
                      background:  n===curPage ? '#E8F1FB' : 'white',
                      color:       n===curPage ? '#1A5FA8' : '#3E3D3A',
                      fontWeight:  n===curPage ? 700 : 500,
                    }}>{n}</button>
                ))}
              <button disabled={curPage>=totalPages} onClick={() => setPage(p=>p+1)}
                className="w-8 h-8 rounded-lg border text-sm disabled:opacity-30"
                style={{ borderColor:'#E4E2DC', background:'white' }}>›</button>
            </div>
          </div>
        )}
        <div className="h-8"/>
      </div>
    </div>
  )
}
