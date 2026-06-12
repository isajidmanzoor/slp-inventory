import { NextRequest, NextResponse } from 'next/server'

const EMAIL_API_KEY = process.env.EMAIL_API_KEY || ''
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@smartlivingpakistan.com'

async function sendEmail(to: string, subject: string, html: string) {
  if (!EMAIL_API_KEY) throw new Error('EMAIL_API_KEY is not configured')

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${EMAIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: EMAIL_FROM, name: 'Smart Living Pakistan' },
      subject,
      content: [{ type: 'text/html', value: html }],
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Email API error: ${res.status} ${res.statusText} ${body}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()
    const { email, threshold, products } = data as {
      email: string
      threshold: number
      products: Array<{ id: number; name: string; stock: number; category: string }>
    }

    if (!email || !products?.length) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const productList = products
      .map(p => `<li><strong>${p.name}</strong> — ${p.stock} left in stock (${p.category})</li>`)
      .join('')

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111;">
        <h2>Low stock alert</h2>
        <p>The stock level has fallen at or below your threshold of <strong>${threshold}</strong> units.</p>
        <p>Products needing attention:</p>
        <ul>${productList}</ul>
        <p>Please restock these items soon.</p>
      </div>
    `

    await sendEmail(email, 'Low stock alert — Smart Living Pakistan', html)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to send notification' }, { status: 500 })
  }
}
