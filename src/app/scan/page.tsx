'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import QRScanner from '@/components/scanner/QRScanner'
import { formatDate } from '@/lib/utils'
import { CalendarDays, CheckCircle, Users } from 'lucide-react'
import Link from 'next/link'

export default function ScanPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [scanLog, setScanLog] = useState<any[]>([])
  const [scanCount, setScanCount] = useState(0)

  useEffect(() => {
    async function fetchSessions() {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', today)
        .lte('date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
        .order('date')
      setSessions(data ?? [])
      if (data?.length === 1) setSelectedSession(data[0])
    }
    fetchSessions()
  }, [])

  async function handleScan(playerId: string): Promise<{ success: boolean; playerName: string; message?: string }> {
    if (!selectedSession) return { success: false, playerName: 'No session selected' }

    // Get player
    const { data: player } = await supabase
      .from('players')
      .select('id, full_name, player_code, category')
      .eq('id', playerId)
      .single()

    if (!player) return { success: false, playerName: 'Player not found', message: `ID: ${playerId}` }

    // Check if already logged
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', selectedSession.id)
      .eq('player_id', playerId)
      .single()

    if (existing) return { success: false, playerName: player.full_name, message: 'Already checked in' }

    // Record attendance
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('attendance').insert({
      session_id: selectedSession.id,
      player_id: playerId,
      status: 'present',
      scanned_at: new Date().toISOString(),
      scanned_by: user?.id,
    })

    if (error) return { success: false, playerName: player.full_name, message: 'Database error' }

    setScanCount(c => c + 1)
    setScanLog(log => [{ player, time: new Date() }, ...log.slice(0, 19)])
    return { success: true, playerName: player.full_name }
  }

  return (
    <div className="min-h-screen bg-navy-gradient p-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <h1 className="text-2xl font-black font-condensed text-white">QR Scanner</h1>
          <p className="text-white/30 text-sm">Attendance Check-in</p>
        </div>
        <Link href="/coach" className="text-teal-400 text-sm hover:underline" onClick={() => window.location.href = '/coach'}>← Dashboard</Link>
      </div>

      {/* Session selector */}
      <div className="card p-4 mb-5">
        <label className="label mb-2 block">Select Session</label>
        {sessions.length === 0 ? (
          <div className="text-center py-4 text-white/30 text-sm">
            No sessions in the next 7 days.
            <Link href="/coach/sessions/new" className="text-teal-400 ml-1 hover:underline">Create one →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <button key={s.id} onClick={() => setSelectedSession(s)}
                className={`w-full text-left p-3 rounded-xl border transition-all
                  ${selectedSession?.id === s.id
                    ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                    : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white'}`}>
                <div className="font-semibold text-sm">{s.title}</div>
                <div className="text-xs mt-0.5 opacity-60">{formatDate(s.date)} · {s.time_start.slice(0,5)} · {s.category}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scanner */}
      {selectedSession ? (
        <>
          <div className="card p-4 mb-5 flex items-center justify-between">
            <div>
              <p className="text-teal-400 font-bold text-sm">{selectedSession.title}</p>
              <p className="text-white/40 text-xs">{formatDate(selectedSession.date)}</p>
            </div>
            <div className="flex items-center gap-2 bg-teal-400/10 border border-teal-400/20 px-3 py-2 rounded-xl">
              <CheckCircle size={16} className="text-teal-400"/>
              <span className="text-teal-400 font-bold text-sm">{scanCount} scanned</span>
            </div>
          </div>

          <QRScanner onScan={handleScan} sessionId={selectedSession.id}/>

          {/* Live log */}
          {scanLog.length > 0 && (
            <div className="card p-4 mt-5">
              <h3 className="section-title mb-3">Check-ins ({scanLog.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {scanLog.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <CheckCircle size={14} className="text-green-400 flex-shrink-0"/>
                    <div className="flex-1">
                      <span className="text-white text-sm font-medium">{entry.player.full_name}</span>
                      <span className="text-white/30 text-xs ml-2">{entry.player.player_code}</span>
                    </div>
                    <span className="text-white/30 text-xs">
                      {entry.time.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="card p-8 text-center text-white/30">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-30"/>
          <p>Select a session above to start scanning</p>
        </div>
      )}
    </div>
  )
}
