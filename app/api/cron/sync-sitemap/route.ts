import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

async function scrapeProduct(url: string) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SLPInventoryBot/2.0)' },
      signal: AbortSignal.timeout(12000),
    })
    const html = await res.text()

    const getMeta = (prop: string) => {
      const m = html.match(new RegExp(`property="${prop}"\\s+content="([^"]+)"`))
        || html.match(new RegExp(`name="${prop}"\\s+content="([^"]+)"`))
      return m ? m[1].trim() : null
    }

    // Name from og:title
    const rawTitle = getMeta('og:title') || ''
    const name = rawTitle.replace(/\s*[-–|].*$/, '').replace(/\s*\|\s*Smart Living.*$/i, '').trim()

    // Image
    const image = getMeta('og:image') || null

    // Price from meta tags (most reliable)
    let price = 0
    let originalPrice = 0
    const metaPrice = getMeta('product:price:amount')
    if (metaPrice) price = parseFloat(metaPrice) || 0

    // JSON-LD for original price
    const jsonLdBlocks = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g) || []
    for (const block of jsonLdBlocks) {
      try {
        const cleaned = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')
        const json = JSON.parse(cleaned)
        const findOffers = (obj: any): void => {
          if (!obj || typeof obj !== 'object') return
          if (obj['@type'] === 'Offer') {
            if (obj.price && !price) price = parseFloat(obj.price) || 0
          }
          if (obj.offers) {
            const o = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers
            if (o?.price && !price) price = parseFloat(o.price) || 0
          }
          // Get original price from priceSpecification
          if (obj.priceSpecification) {
            const specs = Array.isArray(obj.priceSpecification) ? obj.priceSpecification : [obj.priceSpecification]
            for (const spec of specs) {
              if (spec.price && spec.price > price) originalPrice = parseFloat(spec.price) || 0
            }
          }
          Object.values(obj).forEach(v => { if (typeof v === 'object') findOffers(v) })
        }
        findOffers(json)
        if (price > 0) break
      } catch {}
    }

    // Fallback: strikethrough price from HTML
    if (!originalPrice) {
      const delMatch = html.match(/<del[^>]*>[\s\S]*?[\u20a8]([\d,]+)[\s\S]*?<\/del>/)
      if (delMatch) originalPrice = parseFloat(delMatch[1].replace(/,/g, '')) || 0
    }

    // Stock
    const availability = getMeta('product:availability') || ''
    const instock = !availability.toLowerCase().includes('outofstock')
    const stockStatus = instock ? 'instock' : 'outofstock'

    // Stock quantity
    let stockQty = instock ? 10 : 0
    const stockMatch = html.match(/(\d+)\s+in\s+stock/i)
    if (stockMatch) stockQty = parseInt(stockMatch[1]) || stockQty

    // Rating + review count from JSON-LD
    let rating = 0
    let reviewCount = 0
    for (const block of jsonLdBlocks) {
      try {
        const cleaned = block.replace(/<script[^>]*>/, '').replace(/<\/script>/, '')
        const json = JSON.parse(cleaned)
        const findRating = (obj: any): void => {
          if (!obj || typeof obj !== 'object') return
          if (obj.aggregateRating) {
            rating = parseFloat(obj.aggregateRating.ratingValue) || 0
            reviewCount = parseInt(obj.aggregateRating.reviewCount || obj.aggregateRating.ratingCount) || 0
          }
          Object.values(obj).forEach(v => { if (typeof v === 'object') findRating(v) })
        }
        findRating(json)
        if (rating > 0) break
      } catch {}
    }

    // Description from meta
    const description = getMeta('og:description') || getMeta('description') || ''

    // Category from breadcrumb/URL
    const urlParts = url.replace(/\/$/, '').split('/')
    const catSlug = urlParts.length > 5 ? urlParts[urlParts.length - 3] : ''
    const subSlug = urlParts.length > 5 ? urlParts[urlParts.length - 2] : ''

    return {
      name, image, price, originalPrice,
      stockQty, stockStatus, instock,
      rating, reviewCount, description,
      catSlug, subSlug,
    }
  } catch { return null }
}

function guessCategory(url: string): string {
  const u = url.toLowerCase()
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
  return slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

export async function GET(req: NextRequest) {
  const db = supabaseAdmin()
  const now = new Date().toISOString()
  let added = 0, updated = 0, errors = 0
  let priceChanges = 0, stockChanges = 0, newReviews = 0

  try {
    // 1. Fetch sitemap
    const sitemapRes = await fetch('https://smartlivingpakistan.com/product-sitemap.xml', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    const sitemapXml = await sitemapRes.text()

    // 2. Parse URLs + images from sitemap
    const urlBlocks = sitemapXml.split('<url>').slice(1)
    const sitemapProducts: { url: string; sitemapImage: string | null }[] = []
    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/)
      if (!locMatch || !locMatch[1].includes('/product/')) continue
      const imgMatch = block.match(/<image:loc>([^<]+)<\/image:loc>/)
      sitemapProducts.push({ url: locMatch[1], sitemapImage: imgMatch ? imgMatch[1] : null })
    }

    // 3. Get existing products
    const { data: existing } = await db
      .from('products')
      .select('id, store_url, image_url, stock, sale_price, original_price, review_count, rating, stock_status')
    const existingMap = new Map((existing ?? []).map((p: any) => [p.store_url, p]))

    // 4. Process each product with full scraping
    for (const { url, sitemapImage } of sitemapProducts) {
      try {
        const scraped = await scrapeProduct(url)
        const found = existingMap.get(url)
        const now = new Date().toISOString()

        if (found) {
          const updateData: any = { last_synced_at: now }

          // Image update
          if (sitemapImage && !found.image_url?.startsWith('data:')) {
            updateData.image_url = sitemapImage
          }

          // Price change tracking
          if (scraped?.price && scraped.price > 0 && scraped.price !== found.sale_price) {
            // Save to price history
            await db.from('price_history').insert({
              product_id: found.id,
              old_price: found.sale_price,
              new_price: scraped.price,
              changed_at: now,
            })
            updateData.sale_price = scraped.price
            updateData.price_changed_at = now
            priceChanges++
          }

          if (scraped?.originalPrice && scraped.originalPrice > scraped.price) {
            updateData.original_price = scraped.originalPrice
          }

          // Stock change tracking
          if (scraped && scraped.stockStatus !== found.stock_status) {
            stockChanges++
            updateData.stock_status = scraped.stockStatus
            if (!scraped.instock && found.stock > 0) {
              updateData.stock = 0
            } else if (scraped.instock && found.stock === 0) {
              updateData.stock = scraped.stockQty || 10
            }
          }

          // Review count update
          if (scraped?.reviewCount && scraped.reviewCount > (found.review_count || 0)) {
            updateData.review_count = scraped.reviewCount
            updateData.rating = scraped.rating
            newReviews += scraped.reviewCount - (found.review_count || 0)
          }

          // Description update
          if (scraped?.description) updateData.description = scraped.description

          await db.from('products').update(updateData).eq('id', found.id)
          updated++
        } else {
          // New product — full scrape
          const urlParts = url.replace(/\/$/, '').split('/')
          const nameSlug = urlParts[urlParts.length - 1]
          const name = scraped?.name || toTitleCase(nameSlug)
          const category = guessCategory(url)

          await db.from('products').insert({
            name,
            category,
            sub_category: scraped?.subSlug ? toTitleCase(scraped.subSlug) : '',
            sale_price: scraped?.price || 0,
            original_price: scraped?.originalPrice || 0,
            stock: scraped?.stockQty ?? 10,
            stock_status: scraped?.stockStatus || 'instock',
            notes: '',
            image_url: sitemapImage || scraped?.image || null,
            store_url: url,
            alert_enabled: true,
            review_count: scraped?.reviewCount || 0,
            rating: scraped?.rating || 0,
            description: scraped?.description || '',
            last_synced_at: now,
          })
          added++
        }

        await new Promise(r => setTimeout(r, 200))
      } catch { errors++ }
    }

    return NextResponse.json({
      ok: true,
      synced_at: now,
      total: sitemapProducts.length,
      added,
      updated,
      errors,
      price_changes: priceChanges,
      stock_changes: stockChanges,
      new_reviews: newReviews,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
