'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatDate, formatTime, categoryColor } from '@/lib/utils'
import { Plus, CalendarDays, Clock, MapPin, Users, CheckCircle, RotateCcw } from 'lucide-react'
import { toast } from 'react-hot-toast'

export default function SessionsPage() {
  const supabase = createClient()
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')

  useEffect(() => { fetchSessions() }, [tab])

  async function toggleSessionStatus(sessionId: string, currentStatus: string) {
    const newStatus = currentStatus === 'done' ? 'upcoming' : 'done'
    const { error } = await supabase.from('training_sessions').update({ status: newStatus }).eq('id', sessionId)
    if (error) { toast.error('Failed to update session'); return }
    toast.success(newStatus === 'done' ? 'Session marked as done' : 'Session rolled back to upcoming')
    fetchSessions()
  }

  async function fetchSessions() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    let query = supabase
      .from('training_sessions')
      .select('*, attendance(count)')
      .order('date', { ascending: tab === 'upcoming' })

    if (tab === 'upcoming') query = query.gte('date', today)
    else query = query.lt('date', today).limit(20)

    const { data } = await query
    setSessions(data ?? [])
    setLoading(false)
  }

  const sessionTypeIcon = (type: string) => type === 'match' ? '⚽' : type === 'tournament' ? '🏆' : '🏃'

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Sessions</h1>
        <Link href="/coach/sessions/new" className="btn-primary flex items-center gap-2">
          <Plus size={16}/> New Session
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['upcoming', 'past'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all capitalize
              ${tab === t ? 'bg-teal-400/10 border border-teal-400/30 text-teal-400' : 'text-white/40 hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/30 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
          Loading…
        </div>
      ) : sessions.length === 0 ? (
        <div className="card p-12 text-center text-white/30">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-30"/>
          <p>{tab === 'upcoming' ? 'No upcoming sessions' : 'No past sessions'}</p>
          {tab === 'upcoming' && (
            <Link href="/coach/sessions/new" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus size={16}/> Create First Session
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => (
            <div key={s.id} className="card-hover p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Date block */}
                  <div className="w-14 h-14 rounded-xl bg-teal-400/10 border border-teal-400/20 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-teal-400 font-bold text-xs">
                      {new Date(s.date).toLocaleDateString('en', { weekday: 'short' }).toUpperCase()}
                    </span>
                    <span className="text-white font-black text-lg leading-none">{new Date(s.date).getDate()}</span>
                    <span className="text-white/30 text-xs">{new Date(s.date).toLocaleDateString('en', { month: 'short' })}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg">{sessionTypeIcon(s.session_type)}</span>
                      <h3 className="text-white font-bold">{s.title}</h3>
                      <span className={`badge ${categoryColor(s.category)}`}>{s.category}</span>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <span className="flex items-center gap-1.5 text-white/40 text-sm">
                        <Clock size={13}/>{formatTime(s.time_start)} · {s.duration_minutes}min
                      </span>
                      <span className="flex items-center gap-1.5 text-white/40 text-sm">
                        <MapPin size={13}/>{s.venue}
                      </span>
                      <span className="flex items-center gap-1.5 text-white/40 text-sm">
                        <Users size={13}/>{(s.attendance as any)?.[0]?.count ?? 0} attended
                      </span>
                    </div>
                    {s.notes && <p className="text-white/30 text-sm mt-1.5 italic">{s.notes}</p>}
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {tab === 'upcoming' && (
                    <Link href={`/scan?session=${s.id}`} className="btn-primary text-xs py-1.5 px-3">
                      Scan QR
                    </Link>
                  )}
                  <Link href={`/coach/sessions/${s.id}`} className="btn-secondary text-xs py-1.5 px-3">
                    Details
                  </Link>
                  <button onClick={() => toggleSessionStatus(s.id, s.status ?? 'upcoming')}
                    className={`flex items-center gap-1.5 text-xs py-1.5 px-3 rounded-xl border transition-all
                      ${s.status === 'done'
                        ? 'border-amber-500/30 text-amber-400 hover:bg-amber-400/10'
                        : 'border-green-500/30 text-green-400 hover:bg-green-400/10'}`}>
                    {s.status === 'done'
                      ? <><RotateCcw size={12}/> Undo</>
                      : <><CheckCircle size={12}/> Done</>
                    }
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
