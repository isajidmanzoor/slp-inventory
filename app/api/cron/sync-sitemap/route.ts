import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 300

async function scrapeProduct(url: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SLPBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    })
    const html = await res.text()

    const getMeta = (prop: string) => {
      const m = html.match(new RegExp(`property="${prop}"\\s+content="([^"]+)"`))
        || html.match(new RegExp(`name="${prop}"\\s+content="([^"]+)"`))
      return m ? m[1].trim() : null
    }

    // Title
    const title = getMeta('og:title') || getMeta('twitter:title') || ''
    const name = title.replace(/\s*[-–|].*$/, '').replace(/\s*\|\s*Smart Living.*$/i, '').trim()

    // Image
    const image = getMeta('og:image') || null

    // Price from JSON-LD
    let price = 0
    let originalPrice = 0
    const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)
    if (jsonLdMatch) {
      for (const block of jsonLdMatch) {
        try {
          const json = JSON.parse(block.replace(/<[^>]+>/g, ''))
          const findPrice = (obj: any): void => {
            if (!obj || typeof obj !== 'object') return
            if (obj['@type'] === 'Offer' || obj['@type'] === 'AggregateOffer') {
              if (obj.price) price = parseFloat(obj.price) || 0
              if (obj.highPrice) originalPrice = parseFloat(obj.highPrice) || 0
              if (obj.lowPrice && !price) price = parseFloat(obj.lowPrice) || 0
            }
            Object.values(obj).forEach(v => { if (typeof v === 'object') findPrice(v) })
          }
          findPrice(json)
          if (price > 0) break
        } catch {}
      }
    }

    // Fallback price from page
    if (!price) {
      const pm = html.match(/["']price["']\s*:\s*["']([\d.]+)["']/)
        || html.match(/woocommerce-Price-amount[^>]*>[\s\S]*?[\u20a8\u0024]\s*<\/bdi>([\d,]+)/)
      if (pm) price = parseFloat(pm[1].replace(/,/g, '')) || 0
    }

    // Sale price vs regular price
    const regularMatch = html.match(/class="woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?del[\s\S]*?>([\d,]+)/)
    if (regularMatch && !originalPrice) {
      originalPrice = parseFloat(regularMatch[1].replace(/,/g, '')) || 0
    }

    // Stock status
    const availability = getMeta('product:availability') || ''
    const instock = !availability.toLowerCase().includes('outofstock')

    // Stock quantity from page
    let stockQty = instock ? 10 : 0
    const stockMatch = html.match(/(\d+)\s+in\s+stock/i)
      || html.match(/"stockQuantity"\s*:\s*(\d+)/)
      || html.match(/stock_quantity['"]\s*:\s*(\d+)/)
    if (stockMatch) stockQty = parseInt(stockMatch[1]) || (instock ? 10 : 0)

    // Category from URL
    const urlParts = url.replace(/\/$/, '').split('/')
    const catSlug = urlParts[urlParts.length - 3] || ''
    const subSlug = urlParts[urlParts.length - 2] || ''

    return { name, image, price, originalPrice, stockQty, instock, catSlug, subSlug }
  } catch {
    return null
  }
}

function guessCategory(url: string, catSlug: string): string {
  const u = (url + catSlug).toLowerCase()
  if (/ceiling|hanging|wall.light|pillar|garden|solar|flood/.test(u)) return 'Lights'
  if (/switch|volt.meter|doorbell|extension/.test(u)) return 'Switch Plates'
  if (/door.handle|door.lock|drawer|cabinet|gate.lock|stopper/.test(u)) return 'Hardware'
  if (/insect|mosquito|heater|grinder|stove|stanley|commode|washroom/.test(u)) return 'Smart Home'
  if (/yoga|gripper|jumping|skipping|gym/.test(u)) return 'Gym'
  if (/painting|molding|mosaic|wall.art|wall.decor/.test(u)) return 'Wall Decor'
  if (/plant|tree|leaf|home.decor/.test(u)) return 'Home Decor'
  return 'Smart Home'
}

function toTitleCase(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export async function GET(req: NextRequest) {
  const db = supabaseAdmin()
  let added = 0, updated = 0, errors = 0, priceUpdated = 0, stockMismatches = 0

  try {
    // 1. Fetch sitemap
    const sitemapRes = await fetch('https://smartlivingpakistan.com/product-sitemap.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const sitemapXml = await sitemapRes.text()

    // 2. Parse URLs + sitemap images
    const urlBlocks = sitemapXml.split('<url>').slice(1)
    const sitemapProducts: { url: string; sitemapImage: string | null }[] = []

    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/)
      if (!locMatch || !locMatch[1].includes('/product/')) continue
      const imgMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/)
      sitemapProducts.push({
        url: locMatch[1],
        sitemapImage: imgMatch ? imgMatch[1] : null,
      })
    }

    // 3. Get existing products
    const { data: existing } = await db.from('products').select('id, store_url, image_url, stock, sale_price, name')
    const existingMap = new Map((existing ?? []).map((p: any) => [p.store_url, p]))

    // 4. Process each product
    for (const { url, sitemapImage } of sitemapProducts) {
      try {
        const scraped = await scrapeProduct(url)
        const found = existingMap.get(url)

        if (found) {
          const updateData: any = {}

          // Update image if missing or from sitemap
          if (sitemapImage && !found.image_url?.startsWith('data:')) {
            updateData.image_url = sitemapImage
          }

          // Update price if scraped successfully
          if (scraped?.price && scraped.price > 0 && scraped.price !== found.sale_price) {
            updateData.sale_price = scraped.price
            priceUpdated++
          }

          if (scraped?.originalPrice && scraped.originalPrice > 0) {
            updateData.original_price = scraped.originalPrice
          }

          // Stock mismatch detection
          if (scraped) {
            const dbInstock = found.stock > 0
            if (dbInstock !== scraped.instock) stockMismatches++
          }

          if (Object.keys(updateData).length > 0) {
            await db.from('products').update(updateData).eq('id', found.id)
          }
          updated++
        } else {
          // New product
          const urlParts = url.replace(/\/$/, '').split('/')
          const nameSlug = urlParts[urlParts.length - 1]
          const catSlug = urlParts[urlParts.length - 3] || ''
          const subSlug = urlParts[urlParts.length - 2] || ''

          const name = scraped?.name || toTitleCase(nameSlug)
          const category = guessCategory(url, catSlug)
          const subCategory = toTitleCase(subSlug)

          await db.from('products').insert({
            name,
            category,
            sub_category: subCategory,
            sale_price: scraped?.price || 0,
            original_price: scraped?.originalPrice || 0,
            stock: scraped?.stockQty ?? 10,
            notes: '',
            image_url: sitemapImage || scraped?.image || null,
            store_url: url,
            alert_enabled: true,
          })
          added++
        }

        await new Promise(r => setTimeout(r, 150))
      } catch { errors++ }
    }

    return NextResponse.json({
      ok: true,
      total: sitemapProducts.length,
      added,
      updated,
      errors,
      price_updated: priceUpdated,
      stock_mismatches: stockMismatches,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
