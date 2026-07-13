'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, categoryColor } from '@/lib/utils'
import { BarChart3, Download } from 'lucide-react'

export default function AttendancePage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: s } = await supabase.from('training_sessions').select('*').order('date', { ascending: false }).limit(20)
      const { data: p } = await supabase.from('players').select('id, full_name, player_code, category').eq('is_active', true).order('full_name')
      setSessions(s ?? [])
      setAllPlayers(p ?? [])
      if (s?.length) { setSelected(s[0].id); fetchAttendance(s[0].id) }
      setLoading(false)
    }
    init()
  }, [])

  async function fetchAttendance(sessionId: string) {
    const { data } = await supabase.from('attendance').select('*, player:players(full_name, player_code, category)').eq('session_id', sessionId)
    setAttendance(data ?? [])
  }

  function selectSession(id: string) {
    setSelected(id)
    fetchAttendance(id)
  }

  const selectedSession = sessions.find(s => s.id === selected)
  const presentIds = new Set(attendance.filter(a => a.status === 'present').map(a => a.player_id))
  const relevantPlayers = allPlayers.filter(p => !selectedSession?.category || selectedSession.category === 'All' || p.category === selectedSession.category)
  const presentCount = relevantPlayers.filter(p => presentIds.has(p.id)).length

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="page-title mb-2">Attendance</h1>
      <p className="text-white/30 text-sm mb-6">Track presence per session</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session list */}
        <div className="card p-4">
          <h2 className="section-title mb-3">Sessions</h2>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {sessions.map(s => (
              <button key={s.id} onClick={() => selectSession(s.id)}
                className={`w-full text-left p-3 rounded-xl transition-all
                  ${selected === s.id ? 'bg-teal-400/10 border border-teal-400/20' : 'hover:bg-white/5'}`}>
                <div className={`text-sm font-semibold ${selected === s.id ? 'text-teal-400' : 'text-white'}`}>
                  {s.title}
                </div>
                <div className="text-xs text-white/30 mt-0.5">{formatDate(s.date)} · {s.category}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Attendance detail */}
        <div className="lg:col-span-2">
          {selected && selectedSession ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Present', value: presentCount, color: 'text-green-400' },
                  { label: 'Absent', value: relevantPlayers.length - presentCount, color: 'text-red-400' },
                  { label: 'Rate', value: relevantPlayers.length > 0 ? `${Math.round(100 * presentCount / relevantPlayers.length)}%` : '—', color: 'text-teal-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card p-4 text-center">
                    <div className={`text-2xl font-black font-condensed ${color}`}>{value}</div>
                    <div className="text-white/40 text-xs mt-1">{label}</div>
                  </div>
                ))}
              </div>

              {/* Player list */}
              <div className="card overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm">{selectedSession.title}</h3>
                  <span className="text-white/30 text-xs">{formatDate(selectedSession.date)}</span>
                </div>
                <div className="divide-y divide-white/5">
                  {relevantPlayers.map(p => {
                    const isPresent = presentIds.has(p.id)
                    const record = attendance.find(a => a.player_id === p.id)
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPresent ? 'bg-green-400' : 'bg-red-400/40'}`}/>
                        <div className="flex-1">
                          <span className="text-white text-sm font-medium">{p.full_name}</span>
                          <span className="text-white/30 text-xs ml-2">{p.player_code}</span>
                        </div>
                        <span className={`badge text-xs ${isPresent ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-white/5 text-white/30 border-white/10'}`}>
                          {isPresent ? 'Present' : 'Absent'}
                        </span>
                        {record?.scanned_at && (
                          <span className="text-white/20 text-xs">
                            {new Date(record.scanned_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="card p-12 text-center text-white/30">
              <BarChart3 size={40} className="mx-auto mb-3 opacity-30"/>
              <p>Select a session to view attendance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
