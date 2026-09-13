import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// GET - verify session token and return session info
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session')
  const token = url.searchParams.get('token')

  if (!sessionId || !token) {
    return NextResponse.json({ error: 'Missing session or token' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: session } = await supabase
    .from('training_sessions')
    .select('id, title, date, time_start, category, scan_token')
    .eq('id', sessionId)
    .eq('scan_token', token)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Invalid or expired scanner link' }, { status: 404 })
  }

  return NextResponse.json({ session })
}

// POST - record attendance via live scanner
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id, token, player_id } = body

    if (!session_id || !token || !player_id) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify token
    const { data: session } = await supabase
      .from('training_sessions')
      .select('id, scan_token')
      .eq('id', session_id)
      .eq('scan_token', token)
      .single()

    if (!session) {
      return NextResponse.json({ error: 'Invalid scanner token', success: false }, { status: 403 })
    }

    // Get player
    const { data: player } = await supabase
      .from('players')
      .select('id, full_name, player_code')
      .eq('id', player_id)
      .single()

    if (!player) {
      return NextResponse.json({ error: 'Player not found', success: false, player_name: 'Unknown' }, { status: 404 })
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', session_id)
      .eq('player_id', player_id)
      .single()

    if (existing) {
      return NextResponse.json({
        success: false,
        player_name: player.full_name,
        player_code: player.player_code,
        message: 'Already checked in',
      })
    }

    // Record attendance
    const { error } = await supabase.from('attendance').insert({
      session_id,
      player_id,
      status: 'present',
      scanned_at: new Date().toISOString(),
    })

    if (error) {
      return NextResponse.json({ success: false, player_name: player.full_name, message: error.message }, { status: 500 })
    }

    // Auto-award attendance points if rule exists
    const { data: attendanceRule } = await supabase
      .from('point_rules')
      .select('id, points')
      .eq('name', 'Attendance')
      .eq('is_active', true)
      .single()

    if (attendanceRule) {
      await supabase.from('player_points').insert({
        player_id,
        rule_id: attendanceRule.id,
        session_id,
        points: attendanceRule.points,
      })
    }

    return NextResponse.json({
      success: true,
      player_name: player.full_name,
      player_code: player.player_code,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, success: false }, { status: 500 })
  }
}
