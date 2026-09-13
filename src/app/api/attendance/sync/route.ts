import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const supabase = createClient()

    const { error } = await supabase.from('attendance').upsert({
      session_id: body.session_id,
      player_id: body.player_id,
      status: body.status ?? 'present',
      scanned_at: body.scanned_at,
    }, { onConflict: 'session_id,player_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
