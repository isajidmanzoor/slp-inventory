import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://klaaffnnyujrpsniospb.supabase.co'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsYWFmZm5ueXVqcnBzbmlvc3BiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTExODYxMSwiZXhwIjoyMDk2Njk0NjExfQ.oAI1YoJY85pN4wUEv41DM8RLfgwEnHBu5ugFtM33yJE'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function getOgImage(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const html = await res.text()
    const match = html.match(/property="og:image"\s+content="([^"]+)"/)
    return match ? match[1] : null
  } catch { return null }
}

const { data: products, error } = await supabase
  .from('products')
  .select('id, name, store_url, image_url')
  .not('store_url', 'is', null)

if (error) { console.error('DB Error:', error.message); process.exit(1) }
console.log(`Found ${products.length} products with store_url`)

for (const p of products) {
  if (p.image_url && p.image_url.startsWith('http')) {
    console.log(`⏭️  Skip: ${p.name}`)
    continue
  }
  const img = await getOgImage(p.store_url)
  if (img) {
    await supabase.from('products').update({ image_url: img }).eq('id', p.id)
    console.log(`✅ Updated: ${p.name}`)
  } else {
    console.log(`❌ No image: ${p.name}`)
  }
  await new Promise(r => setTimeout(r, 300))
}
console.log('Done!')
