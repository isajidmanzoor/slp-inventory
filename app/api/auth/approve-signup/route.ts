import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import nodemailer from 'nodemailer'

export async function GET(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get('email')
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

    const db = supabaseAdmin()

    // Get pending user
    const { data: pending, error: fetchErr } = await db
      .from('pending_users')
      .select('*')
      .eq('email', email)
      .single()
    if (fetchErr || !pending) throw new Error('Pending user not found')

    // Create actual Supabase user
    const { error: createErr } = await db.auth.admin.createUser({
      email: pending.email,
      password: pending.password,
      email_confirm: true,
      user_metadata: { full_name: pending.full_name },
    })
    if (createErr) throw new Error(createErr.message)

    // Delete from pending
    await db.from('pending_users').delete().eq('email', email)

    // Send welcome email to user
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: pending.email,
      subject: 'Your account has been approved — Smart Living Pakistan',
      html: `
        <h2>Welcome to Smart Living Pakistan! 🎉</h2>
        <p>Hi ${pending.full_name || 'there'},</p>
        <p>Your account has been approved. You can now login to the inventory system.</p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth" style="background:#1A5FA8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:10px;">
          Login Now
        </a>
      `,
    })

    return new NextResponse(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:#1A5FA8">✅ Account Approved!</h2>
        <p>${email} ka account create ho gaya. User ko email bhej di gayi hai.</p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })

  } catch (e: any) {
    return new NextResponse(`
      <html><body style="font-family:sans-serif;text-align:center;padding:60px">
        <h2 style="color:red">❌ Error</h2>
        <p>${e.message}</p>
      </body></html>
    `, { headers: { 'Content-Type': 'text/html' } })
  }
}
