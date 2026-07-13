'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { formatDate, formatTime, categoryColor } from '@/lib/utils'
import { ArrowLeft, QrCode, CheckCircle, XCircle, Clock, Users, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [session, setSession] = useState<any>(null)
  const [attendance, setAttendance] = useState<any[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchData() }, [params.id])

  async function fetchData() {
    setLoading(true)
    const { data: s } = await supabase
      .from('training_sessions')
      .select('*')
      .eq('id', params.id as string)
      .single()
    if (!s) { router.push('/coach/sessions'); return }
    setSession(s)

    const { data: att } = await supabase
      .from('attendance')
      .select('*, player:players(id, full_name, player_code, category)')
      .eq('session_id', params.id as string)
    setAttendance(att ?? [])

    const { data: players } = await supabase
      .from('players')
      .select('id, full_name, player_code, category')
      .eq('is_active', true)
      .or(s.category === 'All' ? 'category.neq.null' : `category.eq.${s.category}`)
      .order('full_name')
    setAllPlayers(players ?? [])
    setLoading(false)
  }

  async function markAttendance(playerId: string, status: 'present' | 'absent') {
    const { data: { user } } = await supabase.auth.getUser()
    const existing = attendance.find(a => a.player_id === playerId)
    if (existing) {
      await supabase.from('attendance').update({ status }).eq('id', existing.id)
    } else {
      await supabase.from('attendance').insert({
        session_id: params.id, player_id: playerId, status,
        scanned_at: new Date().toISOString(), scanned_by: user?.id,
      })
    }
    fetchData()
  }

  async function deleteSession() {
    if (!confirm('Delete this session and all its attendance records?')) return
    await supabase.from('training_sessions').delete().eq('id', params.id as string)
    toast.success('Session deleted')
    router.push('/coach/sessions')
  }

  if (loading || !session) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  const presentIds = new Set(attendance.filter(a => a.status === 'present').map(a => a.player_id))
  const presentCount = allPlayers.filter(p => presentIds.has(p.id)).length
  const sessionPast = new Date(session.date) < new Date()

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/coach/sessions"
        className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> Sessions
      </Link>

      {/* Session header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">{session.session_type === 'match' ? '⚽' : session.session_type === 'tournament' ? '🏆' : '🏃'}</span>
              <h1 className="text-2xl font-black font-condensed text-white">{session.title}</h1>
              <span className={`badge ${categoryColor(session.category)}`}>{session.category}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-4">
              {[
                ['Date', formatDate(session.date)],
                ['Time', `${formatTime(session.time_start)} · ${session.duration_minutes}min`],
                ['Venue', session.venue],
                ['Type', session.session_type],
                ['Attendance', `${presentCount}/${allPlayers.length}`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="label">{label}</p>
                  <p className="text-white text-sm font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {session.notes && <p className="text-white/40 text-sm mt-3 italic">{session.notes}</p>}
          </div>
          <div className="flex flex-col gap-2">
            {!sessionPast && (
              <Link href={`/scan?session=${session.id}`} className="btn-primary flex items-center gap-2 text-sm">
                <QrCode size={14}/> Scan QR
              </Link>
            )}
            <button onClick={deleteSession} className="btn-danger flex items-center gap-2 text-sm">
              <Trash2 size={14}/> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Attendance list */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-white font-bold">Attendance Register</h2>
          <div className="flex gap-3 text-sm">
            <span className="text-green-400">{presentCount} present</span>
            <span className="text-white/30">·</span>
            <span className="text-red-400/70">{allPlayers.length - presentCount} absent</span>
          </div>
        </div>
        {allPlayers.length === 0 ? (
          <div className="p-8 text-center text-white/30">
            <Users size={36} className="mx-auto mb-3 opacity-30"/>
            <p>No players in this category</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {allPlayers.map(p => {
              const record = attendance.find(a => a.player_id === p.id)
              const isPresent = record?.status === 'present'
              const isAbsent = record?.status === 'absent'
              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-teal-400 font-bold text-xs">{p.full_name[0]}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{p.full_name}</p>
                    <p className="text-white/30 text-xs font-mono">{p.player_code}</p>
                  </div>
                  {record?.scanned_at && (
                    <span className="text-white/20 text-xs hidden sm:block">
                      {new Date(record.scanned_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {/* Manual toggle buttons */}
                  <div className="flex gap-1.5">
                    <button onClick={() => markAttendance(p.id, 'present')}
                      className={`p-1.5 rounded-lg transition-all ${isPresent ? 'bg-green-500/20 text-green-400' : 'text-white/20 hover:text-green-400 hover:bg-green-500/10'}`}>
                      <CheckCircle size={16}/>
                    </button>
                    <button onClick={() => markAttendance(p.id, 'absent')}
                      className={`p-1.5 rounded-lg transition-all ${isAbsent ? 'bg-red-500/20 text-red-400' : 'text-white/20 hover:text-red-400 hover:bg-red-500/10'}`}>
                      <XCircle size={16}/>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
