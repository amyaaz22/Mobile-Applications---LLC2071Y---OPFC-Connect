'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import QRScanner from '@/components/scanner/QRScanner'
import { formatDate } from '@/lib/utils'
import { CalendarDays, CheckCircle, Wifi, WifiOff, Download } from 'lucide-react'
import Link from 'next/link'
import { usePWA } from '@/hooks/usePWA'

// Sessions + roster are cached here on every successful online load so the
// scanner still works with zero connectivity at the field — the service
// worker deliberately never caches supabase.co requests (those go through
// the offline attendance queue instead), so without this, opening /scan
// offline left the session picker permanently empty.
const CACHE_SESSIONS_KEY = 'opfc_cached_sessions'
const CACHE_PLAYERS_KEY = 'opfc_cached_players'

export default function ScanPage() {
  const supabase = createClient()
  const { isOnline, isInstallable, installApp, queueOfflineAttendance, getOfflineQueue } = usePWA()
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [scanLog, setScanLog] = useState<any[]>([])
  const [scanCount, setScanCount] = useState(0)
  const [offlineQueue, setOfflineQueue] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetchSessions()
    fetchRoster()
    loadOfflineQueue()
  }, [])

  // Re-check offline queue when coming back online, and refresh the caches
  useEffect(() => {
    if (isOnline) {
      loadOfflineQueue()
      syncOfflineRecords()
      fetchSessions()
      fetchRoster()
    }
  }, [isOnline])

  function loadCachedSessions() {
    try {
      const cached = localStorage.getItem(CACHE_SESSIONS_KEY)
      const data = cached ? JSON.parse(cached) : []
      setSessions(data)
      if (data.length === 1) setSelectedSession(data[0])
    } catch { /* no cache available yet */ }
  }

  async function fetchSessions() {
    const today = new Date().toISOString().split('T')[0]
    try {
      const { data, error } = await supabase
        .from('training_sessions')
        .select('*')
        .gte('date', today)
        .lte('date', new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
        .order('date')
      if (error) throw error
      setSessions(data ?? [])
      if (data?.length === 1) setSelectedSession(data[0])
      localStorage.setItem(CACHE_SESSIONS_KEY, JSON.stringify(data ?? []))
    } catch {
      // Offline or request failed — fall back to whatever was cached last time we were online
      loadCachedSessions()
    }
  }

  // Full active roster, cached so handleScan can resolve a scanned player
  // offline without ever touching the network.
  async function fetchRoster() {
    try {
      const { data, error } = await supabase.from('players').select('id, full_name, player_code, category').eq('is_active', true)
      if (error) throw error
      localStorage.setItem(CACHE_PLAYERS_KEY, JSON.stringify(data ?? []))
    } catch { /* offline — keep the existing cache as-is */ }
  }

  function getCachedPlayer(playerId: string) {
    try {
      const cached = localStorage.getItem(CACHE_PLAYERS_KEY)
      const list = cached ? JSON.parse(cached) : []
      return list.find((p: any) => p.id === playerId) ?? null
    } catch { return null }
  }

  async function loadOfflineQueue() {
    const queue = await getOfflineQueue()
    setOfflineQueue(queue)
  }

  async function syncOfflineRecords() {
    if (!isOnline) return
    const queue = await getOfflineQueue()
    if (!queue.length) return

    setSyncing(true)
    let synced = 0
    for (const record of queue) {
      try {
        const res = await fetch('/api/attendance/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(record),
        })
        if (res.ok) synced++
      } catch { /* retry later */ }
    }
    if (synced > 0) {
      await loadOfflineQueue()
    }
    setSyncing(false)
  }

  async function handleScan(playerId: string): Promise<{ success: boolean; playerName: string; message?: string }> {
    if (!selectedSession) return { success: false, playerName: 'No session selected' }

    // Get player info — live when online, falling back to the cached roster
    // (populated by fetchRoster) when offline or the request fails.
    let player: any = null
    if (isOnline) {
      const { data } = await supabase
        .from('players')
        .select('id, full_name, player_code, category')
        .eq('id', playerId)
        .single()
      player = data
    }
    if (!player) player = getCachedPlayer(playerId)

    if (!player) return { success: false, playerName: 'Player not found', message: `ID: ${playerId}` }

    const record = {
      id: `${selectedSession.id}-${playerId}-${Date.now()}`,
      session_id: selectedSession.id,
      player_id: playerId,
      player_name: player.full_name,
      status: 'present' as const,
      scanned_at: new Date().toISOString(),
    }

    if (!isOnline) {
      // Queue for later sync
      await queueOfflineAttendance(record)
      setScanCount(c => c + 1)
      setScanLog(log => [{ player, time: new Date(), offline: true }, ...log.slice(0, 19)])
      await loadOfflineQueue()
      return { success: true, playerName: player.full_name, message: '⚡ Saved offline — will sync when connected' }
    }

    // Online — save directly
    const { data: { user } } = await supabase.auth.getUser()
    const { data: existing } = await supabase
      .from('attendance')
      .select('id')
      .eq('session_id', selectedSession.id)
      .eq('player_id', playerId)
      .single()

    if (existing) return { success: false, playerName: player.full_name, message: 'Already checked in' }

    const { error } = await supabase.from('attendance').insert({
      session_id: selectedSession.id,
      player_id: playerId,
      status: 'present',
      scanned_at: new Date().toISOString(),
      scanned_by: user?.id,
    })

    if (error) return { success: false, playerName: player.full_name, message: 'Database error' }

    setScanCount(c => c + 1)
    setScanLog(log => [{ player, time: new Date(), offline: false }, ...log.slice(0, 19)])
    return { success: true, playerName: player.full_name }
  }

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto" style={{ background: '#0D1B2A' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <div>
          <h1 className="text-2xl font-black font-condensed text-white">QR Scanner</h1>
          <p className="text-white/30 text-sm">Attendance Check-in</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Online/offline indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold
            ${isOnline ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
            {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button onClick={() => window.location.href = '/coach'} className="text-teal-400 text-sm hover:underline">← Dashboard</button>
        </div>
      </div>

      {/* Offline banner */}
      {!isOnline && (
        <div className="card p-3 mb-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-start gap-2">
            <WifiOff size={14} className="text-amber-400 flex-shrink-0 mt-0.5"/>
            <div>
              <p className="text-amber-400 text-xs font-bold">Working Offline</p>
              <p className="text-amber-400/70 text-xs mt-0.5">Scans are saved locally and will sync automatically when you reconnect.</p>
            </div>
          </div>
        </div>
      )}

      {/* Offline queue indicator */}
      {offlineQueue.length > 0 && isOnline && (
        <div className="card p-3 mb-4 border-teal-400/20 bg-teal-400/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-teal-400"/>
              <p className="text-teal-400 text-xs font-bold">{offlineQueue.length} offline scans pending sync</p>
            </div>
            <button onClick={syncOfflineRecords} disabled={syncing}
              className="text-teal-400 text-xs hover:underline">
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>
      )}

      {/* Install PWA */}
      {isInstallable && (
        <div className="card p-3 mb-4 border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-300 text-xs font-bold">Install OPFC Connect</p>
              <p className="text-purple-300/60 text-xs">Add to home screen for offline use</p>
            </div>
            <button onClick={installApp} className="flex items-center gap-1.5 text-purple-300 text-xs border border-purple-500/30 px-3 py-1.5 rounded-lg hover:bg-purple-500/10">
              <Download size={12}/> Install
            </button>
          </div>
        </div>
      )}

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
                <div className="text-xs mt-0.5 opacity-60">{formatDate(s.date)} · {s.time_start?.slice(0,5)} · {s.category}</div>
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
                    <CheckCircle size={14} className={entry.offline ? 'text-amber-400 flex-shrink-0' : 'text-green-400 flex-shrink-0'}/>
                    <div className="flex-1">
                      <span className="text-white text-sm font-medium">{entry.player.full_name}</span>
                      <span className="text-white/30 text-xs ml-2">{entry.player.player_code}</span>
                      {entry.offline && <span className="text-amber-400/70 text-xs ml-2">offline</span>}
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
