import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'

// Admin-only (area 'staff'): invite a brand-new person by email and set
// their role directly. The caller's session is verified before the
// service-role client (which bypasses RLS) is ever touched.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    const { data: caller } = await supabase.from('profiles').select('role, permissions').eq('id', user.id).single()
    if (!hasPermission(caller, 'staff')) {
      return NextResponse.json({ error: 'Only admins with Staff & Parents access can invite new accounts' }, { status: 403 })
    }

    const { email, full_name, role } = await req.json()
    if (!email || !full_name || !['coach', 'parent'].includes(role)) {
      return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name },
    })

    if (inviteError) {
      const message = /already registered|already exists/i.test(inviteError.message)
        ? 'This email already has an account — use "Promote existing user" instead.'
        : inviteError.message
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const newId = invited.user?.id
    if (newId) {
      const { error: roleError } = await admin.from('profiles').update({ role, full_name }).eq('id', newId)
      if (roleError) {
        return NextResponse.json({
          success: true,
          warning: `Invite sent, but setting their role failed: ${roleError.message}. Use "Promote existing user" once they've confirmed their email.`,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Invite failed' }, { status: 500 })
  }
}
