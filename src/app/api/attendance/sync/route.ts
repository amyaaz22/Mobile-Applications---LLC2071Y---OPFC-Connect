import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('attendance').upsert({
      session_id: body.session_id,
      player_id: body.player_id,
      status: body.status ?? 'present',
      scanned_at: body.scanned_at,
      scanned_by: user?.id ?? null,
    }, { onConflict: 'session_id,player_id' })

    if (error) {
      // A foreign-key violation (session or player no longer exists) can
      // never succeed on retry — tell the client to drop it from the
      // offline queue instead of retrying forever.
      const permanent = error.code === '23503'
      return NextResponse.json({ error: error.message, permanent }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
