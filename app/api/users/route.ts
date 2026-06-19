import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

async function getCallerUser(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data: { user } } = await supabaseAdmin().auth.getUser(token)
  return user
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getCallerUser(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data, error } = await supabaseAdmin().auth.admin.listUsers()
    if (error) throw new Error(error.message)
    return NextResponse.json(data.users.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || '',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    })))
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const caller = await getCallerUser(req)
    if (!caller) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    if (userId === caller.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
