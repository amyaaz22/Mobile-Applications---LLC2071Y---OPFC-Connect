import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'

// Admin-only (area 'system'): lists every account with auth-level info
// (last sign-in, email confirmed) merged with its profile row. The caller's
// session is verified against profiles before the service-role client
// (which can read auth.users, bypassing RLS) is ever touched.
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

    const { data: caller } = await supabase.from('profiles').select('role, permissions').eq('id', user.id).single()
    if (!hasPermission(caller, 'system')) {
      return NextResponse.json({ error: 'Only the Super Admin panel can view this' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { data: profiles } = await admin.from('profiles').select('*').order('created_at', { ascending: false })

    // auth.admin.listUsers() paginates at 50/page by default — walk all pages.
    const authById = new Map<string, { last_sign_in_at: string | null; email_confirmed_at: string | null }>()
    let page = 1
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (error || !data?.users?.length) break
      data.users.forEach(u => authById.set(u.id, {
        last_sign_in_at: u.last_sign_in_at ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
      }))
      if (data.users.length < 200) break
      page++
    }

    const merged = (profiles ?? []).map(p => ({
      ...p,
      last_sign_in_at: authById.get(p.id)?.last_sign_in_at ?? null,
      email_confirmed_at: authById.get(p.id)?.email_confirmed_at ?? null,
    }))

    return NextResponse.json({ users: merged })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to load accounts' }, { status: 500 })
  }
}
