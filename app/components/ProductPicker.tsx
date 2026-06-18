'use client'
import { useState, useEffect, useRef } from 'react'
import { Search, X, Package } from 'lucide-react'
import type { Product } from '@/lib/supabase'

export default function ProductPicker({ onSelect, onClose }: {
  onSelect: (p: Product) => void
  onClose: () => void
}) {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    ;(async () => {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data } = await supabase.from('products').select('*').order('name')
        setAllProducts(data || [])
        setResults(data || [])
      } catch {
        setAllProducts([])
      }
      setLoading(false)
    })()
  }, [])

  useEffect(() => {
    const q = query.trim().toLowerCase()
    if (!q) { setResults(allProducts); return }
    setResults(allProducts.filter(p =>
      p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    ))
  }, [query, allProducts])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ background:'rgba(0,0,0,0.48)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col"
        style={{ maxHeight:'80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white"
          style={{ borderColor:'#E4E2DC' }}>
          <h3 className="text-base font-bold">Select a Product</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg border flex items-center justify-center"
            style={{ borderColor:'#E4E2DC', color:'#6B6A66' }}>
            <X size={16}/>
          </button>
        </div>

        <div className="p-4 border-b" style={{ borderColor:'#E4E2DC' }}>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'#9C9B97' }}/>
            <input ref={inputRef} type="search" placeholder="Search products by name or category…"
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-xl border text-sm outline-none focus:border-blue-500"
              style={{ borderColor:'#E4E2DC', color:'#111827' }}/>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="text-center py-10 text-sm" style={{ color:'#9C9B97' }}>Loading products…</div>
          ) : results.length === 0 ? (
            <div className="text-center py-10 text-sm" style={{ color:'#9C9B97' }}>
              No products found. You can still add a custom item manually.
            </div>
          ) : (
            results.map(p => (
              <button key={p.id} onClick={() => onSelect(p)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 text-left">
                <div className="w-11 h-11 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
                  style={{ background:'#F5F4F0' }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="w-full h-full object-cover"/>
                    : <Package size={18} style={{ color:'#9C9B97' }}/>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <div className="text-xs" style={{ color:'#9C9B97' }}>
                    {p.category} · Stock: {p.stock}
                  </div>
                </div>
                <div className="text-sm font-bold flex-shrink-0">₨{p.sale_price.toLocaleString()}</div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
