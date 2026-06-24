import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import nodemailer from 'nodemailer'

const resetRequests = new Map<string, number>()
const cooldownMs = 60_000
const productionAppUrl = 'https://inventoryagent.vercel.app'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildResetEmail(resetLink: string) {
  const safeLink = escapeHtml(resetLink)

  return `
    <div style="font-family:Arial,sans-serif;color:#1C1B19;line-height:1.5;max-width:560px;margin:0 auto;padding:24px;">
      <h2 style="color:#1A5FA8;margin:0 0 12px;">Reset your password</h2>
      <p>We received a request to reset your Smart Living Pakistan Inventory password.</p>
      <p>
        <a href="${safeLink}" style="background:#1A5FA8;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
          Reset Password
        </a>
      </p>
      <p style="font-size:13px;color:#6B6A66;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="font-size:13px;word-break:break-all;color:#1A5FA8;">${safeLink}</p>
      <p style="font-size:12px;color:#777;margin-top:24px;">If you did not request this, you can ignore this email.</p>
    </div>
  `
}

function getAppBaseUrl(req: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
  if (configuredUrl && !configuredUrl.includes('localhost')) return configuredUrl
  if (!req.nextUrl.origin.includes('localhost')) return req.nextUrl.origin
  return productionAppUrl
}

function buildAppResetLink(baseUrl: string, tokenHash: string) {
  const url = new URL('/auth', baseUrl)
  url.searchParams.set('mode', 'reset-password')
  url.searchParams.set('type', 'recovery')
  url.searchParams.set('token_hash', tokenHash)
  return url.toString()
}

async function sendResetEmail(to: string, actionLink: string) {
  const html = buildResetEmail(actionLink)

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `Smart Living Pakistan <${process.env.SMTP_USER}>`,
      to,
      subject: 'Reset your password - Smart Living Pakistan',
      html,
    })
    return
  }

  const emailApiKey = process.env.EMAIL_API_KEY || process.env.SENDGRID_API_KEY
  if (!emailApiKey) {
    throw new Error('Email is not configured yet. Add SMTP_USER/SMTP_PASS or EMAIL_API_KEY in Vercel environment variables.')
  }

  const fromEmail = process.env.EMAIL_FROM || 'no-reply@smartlivingpakistan.com'
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${emailApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: fromEmail, name: 'Smart Living Pakistan' },
      subject: 'Reset your password - Smart Living Pakistan',
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
    const { email } = await req.json()
    const emailVal = typeof email === 'string' ? email.trim().toLowerCase() : ''

    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    }

    const clientKey = `${req.headers.get('x-forwarded-for') || 'unknown'}:${emailVal}`
    const lastRequestAt = resetRequests.get(clientKey) || 0
    if (Date.now() - lastRequestAt < cooldownMs) {
      return NextResponse.json({ error: 'Please wait 1 minute before sending another reset link' }, { status: 429 })
    }
    resetRequests.set(clientKey, Date.now())

    const baseUrl = getAppBaseUrl(req)
    const redirectTo = `${baseUrl}/auth?mode=reset-password`
    const { data, error } = await supabaseAdmin().auth.admin.generateLink({
      type: 'recovery',
      email: emailVal,
      options: { redirectTo },
    } as any)

    if (error) {
      if (error.message.toLowerCase().includes('user not found')) {
        return NextResponse.json({ ok: true })
      }
      throw new Error(error.message)
    }

    const actionLink = (data as any)?.properties?.action_link
    const tokenHash = (data as any)?.properties?.hashed_token
    if (!actionLink && !tokenHash) throw new Error('Could not generate reset link')

    const resetLink = tokenHash ? buildAppResetLink(baseUrl, tokenHash) : actionLink
    await sendResetEmail(emailVal, resetLink)
    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to send reset email' }, { status: 500 })
  }
}
