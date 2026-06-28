'use client'
import { useEffect, useRef, useState } from 'react'

/**
 * Generates a QR code as a data URL using the `qrcode` package.
 * Falls back gracefully (renders nothing) if generation fails,
 * so a missing/broken QR never breaks the invoice layout.
 */
export function InvoiceQR({ value, size = 96, label }: { value: string; size?: number; label?: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed]   = useState(false)

  useEffect(() => {
    let active = true
    if (!value) { setDataUrl(null); return }
    import('qrcode')
      .then(QRCode => QRCode.toDataURL(value, { width: size, margin: 1, color: { dark: '#1C1B19', light: '#FFFFFF' } }))
      .then(url => { if (active) setDataUrl(url) })
      .catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [value, size])

  if (!value || failed) return null

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      {dataUrl
        ? <img src={dataUrl} width={size} height={size} alt={label || 'QR code'} style={{ borderRadius:6 }}/>
        : <div style={{ width:size, height:size, background:'#F5F4F0', borderRadius:6 }}/>
      }
      {label && <span style={{ fontSize:9, color:'#9C9B97', textAlign:'center', maxWidth:size }}>{label}</span>}
    </div>
  )
}

/**
 * Simple Code-128-style barcode rendered as SVG bars (no external image
 * dependency, prints crisply, scales with the page). This is a visual
 * representation for the invoice number — for true scanning compliance
 * a proper Code128 encoding library could be swapped in later.
 */
export function InvoiceBarcode({ value, height = 46 }: { value: string; height?: number }) {
  // Deterministic pseudo-barcode pattern derived from the invoice number's
  // characters, so the same invoice number always renders the same bars.
  const bars = barPattern(value)
  const totalWidth = bars.reduce((s, w) => s + w, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
      <svg width={totalWidth} height={height} viewBox={`0 0 ${totalWidth} ${height}`}>
        {bars.map((w, i) => {
          const x = bars.slice(0, i).reduce((s, ww) => s + ww, 0)
          const isBar = i % 2 === 0
          return isBar
            ? <rect key={i} x={x} y={0} width={w} height={height - 12} fill="#1C1B19"/>
            : null
        })}
      </svg>
      <span style={{ fontSize:11, fontFamily:'monospace', letterSpacing:1, color:'#1C1B19' }}>{value}</span>
    </div>
  )
}

function barPattern(value: string): number[] {
  const widths: number[] = []
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    widths.push(2 + (code % 3))      // bar
    widths.push(1 + ((code >> 2) % 2)) // gap
  }
  return widths.length ? widths : [2, 1]
}
