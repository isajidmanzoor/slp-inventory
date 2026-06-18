import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300

async function getOgData(url: string) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const html = await res.text()
    const get = (prop: string) => {
      const m = html.match(new RegExp('property="' + prop + '"\\s+content="([^"]+)"'))
      return m ? m[1] : null
    }
    const priceMatch = html.match(/[\u20a8]\s*([\d,]+)/)
    const price = priceMatch ? parseFloat(priceMatch[1].replace(/,/g, '')) : 0
    return { title: get('og:title'), image: get('og:image'), price }
  } catch { return null }
}

function guessCategory(url: string, title: string): string {
  const u = (url + title).toLowerCase()
  if (/ceiling|hanging|wall.light|pillar|garden|solar|flood/.test(u)) return 'Lights'
  if (/switch|volt.meter|doorbell|extension/.test(u)) return 'Switch Plates'
  if (/door.handle|door.lock|drawer|cabinet|gate.lock|stopper/.test(u)) return 'Hardware'
  if (/insect|mosquito|heater|grinder|stove|stanley|commode/.test(u)) return 'Smart Home'
  if (/yoga|gripper|jumping|skipping/.test(u)) return 'Gym'
  if (/painting|molding|mosaic|wall.art/.test(u)) return 'Wall Decor'
  if (/plant|tree|leaf/.test(u)) return 'Home Decor'
  return 'Smart Home'
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== 'Bearer ' + cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin()
  let added = 0, updated = 0, errors = 0

  try {
    const sitemapRes = await fetch('https://smartlivingpakistan.com/product-sitemap.xml')
    const sitemapXml = await sitemapRes.text()
    const regex = /<loc>([^<]+)<\/loc>/g
    const urls: string[] = []
    let match
    while ((match = regex.exec(sitemapXml)) !== null) {
      if (match[1].includes('/product/')) urls.push(match[1])
    }

    console.log('Found ' + urls.length + ' products in sitemap')

    const { data: existing } = await db.from('products').select('id, store_url, image_url')
    const existingMap = new Map((existing ?? []).map((p: any) => [p.store_url, p]))

    for (const url of urls) {
      try {
        const og = await getOgData(url)
        if (!og || !og.title) { errors++; continue }

        const title = og.title.replace(/\s*[-|].*$/, '').trim()
        const category = guessCategory(url, title)
        const found = existingMap.get(url)

        if (found) {
          const updateData: any = { store_url: url }
          if (og.image && !(found as any).image_url?.startsWith('data:')) {
            updateData.image_url = og.image
          }
          await db.from('products').update(updateData).eq('id', (found as any).id)
          updated++
        } else {
          await db.from('products').insert({
            name: title,
            category,
            sub_category: '',
            sale_price: og.price || 0,
            original_price: 0,
            stock: 10,
            notes: '',
            image_url: og.image,
            store_url: url,
            alert_enabled: true,
          })
          added++
        }
        await new Promise(r => setTimeout(r, 200))
      } catch { errors++ }
    }

    return NextResponse.json({ ok: true, total: urls.length, added, updated, errors })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
