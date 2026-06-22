import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300

function guessCategory(url: string): string {
  const u = url.toLowerCase()
  if (/ceiling|hanging|wall.light|pillar|garden|solar|flood/.test(u)) return 'Lights'
  if (/switch|volt.meter|doorbell|extension/.test(u)) return 'Switch Plates'
  if (/door.handle|door.lock|drawer|cabinet|gate.lock|stopper/.test(u)) return 'Hardware'
  if (/insect|mosquito|heater|grinder|stove|stanley|commode/.test(u)) return 'Smart Home'
  if (/yoga|gripper|jumping|skipping/.test(u)) return 'Gym'
  if (/painting|molding|mosaic|wall.art/.test(u)) return 'Wall Decor'
  if (/plant|tree|leaf/.test(u)) return 'Home Decor'
  return 'Smart Home'
}

function slugToName(url: string): string {
  const parts = url.replace(/\/$/, '').split('/')
  const slug = parts[parts.length - 1] || parts[parts.length - 2]
  return slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export async function GET(req: NextRequest) {
  const db = supabaseAdmin()
  let added = 0, updated = 0, errors = 0

  try {
    // Fetch sitemap only — no page visits needed!
    const sitemapRes = await fetch('https://smartlivingpakistan.com/product-sitemap.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const sitemapXml = await sitemapRes.text()

    // Parse all product URLs + their first image from sitemap
    const urlBlocks = sitemapXml.split('<url>').slice(1)
    const products: { url: string; image: string | null }[] = []

    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/)
      if (!locMatch || !locMatch[1].includes('/product/')) continue
      const imgMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/)
      products.push({
        url: locMatch[1],
        image: imgMatch ? imgMatch[1] : null,
      })
    }

    // Get existing products from DB
    const { data: existing } = await db.from('products').select('id, store_url, image_url')
    const existingMap = new Map((existing ?? []).map((p: any) => [p.store_url, p]))

    for (const { url, image } of products) {
      try {
        const found = existingMap.get(url)
        const name = slugToName(url)
        const category = guessCategory(url)

        if (found) {
          const updateData: any = {}
          if (image && !(found as any).image_url?.startsWith('data:')) {
            updateData.image_url = image
          }
          if (Object.keys(updateData).length > 0) {
            await db.from('products').update(updateData).eq('id', (found as any).id)
          }
          updated++
        } else {
          await db.from('products').upsert({
            name,
            category,
            sub_category: '',
            sale_price: 0,
            original_price: 0,
            stock: 10,
            notes: '',
            image_url: image,
            store_url: url,
            alert_enabled: true,
          }, { onConflict: 'store_url' })
          added++
        }
      } catch { errors++ }
    }

    return NextResponse.json({ ok: true, total: products.length, added, updated, errors })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
