import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Save pending user in DB
    const db = supabaseAdmin()
    const { error } = await db.from('pending_users').insert({
      email: email.trim(),
      password,
      full_name: full_name || '',
      requested_at: new Date().toISOString(),
    })
    if (error) throw new Error(error.message)

    // Send approval email to admin
    const approveUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/approve-signup?email=${encodeURIComponent(email)}`
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: 587,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.SMTP_USER,
      subject: `New Signup Request — ${email}`,
      html: `
        <h2>New user wants to join Smart Living Pakistan Inventory</h2>
        <p><b>Name:</b> ${full_name || 'Not provided'}</p>
        <p><b>Email:</b> ${email}</p>
        <p>Click below to approve:</p>
        <a href="${approveUrl}" style="background:#1A5FA8;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:10px;">
          ✅ Approve & Create Account
        </a>
        <p style="margin-top:20px;color:#999;font-size:12px;">If you did not expect this, ignore this email.</p>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
