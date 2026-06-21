import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import nodemailer from 'nodemailer'

export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    const db = supabaseAdmin()
    const { error } = await db.from('pending_users').upsert({
      email: email.trim(),
      password,
      full_name: full_name || '',
      requested_at: new Date().toISOString(),
    }, { onConflict: 'email' })
    if (error) throw new Error(error.message)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    const approveUserUrl = `${baseUrl}/api/auth/approve-signup?email=${encodeURIComponent(email)}&role=user`
    const approveAdminUrl = `${baseUrl}/api/auth/approve-signup?email=${encodeURIComponent(email)}&role=admin`

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
        <p>Choose how to approve this user:</p>
        <table cellpadding="0" cellspacing="0" style="margin-top:14px;">
          <tr>
            <td>
              <a href="${approveUserUrl}" style="background:#1A5FA8;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;margin-right:10px;">
                ✅ Approve as User
              </a>
            </td>
            <td>
              <a href="${approveAdminUrl}" style="background:#9B2B2B;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
                👑 Approve as Admin
              </a>
            </td>
          </tr>
        </table>
        <p style="margin-top:20px;color:#999;font-size:12px;">
          <b>User</b> can view inventory (read-only). <b>Admin</b> can edit/delete products, manage users, and access invoices.<br/>
          If you did not expect this, ignore this email.
        </p>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
