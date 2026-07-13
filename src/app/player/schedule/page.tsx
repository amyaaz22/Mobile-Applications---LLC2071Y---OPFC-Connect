'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatTime } from '@/lib/utils'
import { MapPin, Clock, Calendar } from 'lucide-react'

export default function PlayerSchedulePage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [past, setPast] = useState<any[]>([])
  const [category, setCategory] = useState('First Team')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: player } = await supabase.from('players').select('category').eq('profile_id', user.id).single()
      const cat = (player as any)?.category ?? 'First Team'
      setCategory(cat)
      const today = new Date().toISOString().split('T')[0]
      const [{ data: up }, { data: pa }] = await Promise.all([
        supabase.from('training_sessions').select('*').gte('date', today).or(`category.eq.${cat},category.eq.All`).order('date'),
        supabase.from('training_sessions').select('*').lt('date', today).or(`category.eq.${cat},category.eq.All`).order('date', { ascending: false }).limit(10),
      ])
      setSessions(up ?? [])
      setPast(pa ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{background:'#0D1B2A'}}><div style={{color:'rgba(255,255,255,0.4)'}}>Loading…</div></div>

  const typeIcon = (t: string) => t === 'match' ? '⚽' : t === 'tournament' ? '🏆' : '🏃'
  const SessionTile = ({ s, isNext }: { s: any; isNext?: boolean }) => (
    <div className={`card p-4 ${isNext ? 'border-teal-400/30' : ''}`}>
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${isNext ? 'bg-teal-400/20 border border-teal-400/30' : 'bg-white/5'}`}>
          <span className={`font-bold text-xs ${isNext ? 'text-teal-400' : 'text-white/40'}`}>{new Date(s.date).toLocaleDateString('en',{weekday:'short'}).toUpperCase()}</span>
          <span className={`font-black text-xl leading-none ${isNext ? 'text-teal-400' : 'text-white'}`}>{new Date(s.date).getDate()}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2"><span>{typeIcon(s.session_type)}</span><h3 className="text-white font-bold">{s.title}</h3>{isNext && <span className="bg-teal-400 text-navy-900 text-[9px] font-black px-2 py-0.5 rounded">NEXT</span>}</div>
          <div className="flex flex-wrap gap-3 mt-2">
            <span className="flex items-center gap-1.5 text-white/40 text-sm"><Clock size={13}/>{formatTime(s.time_start)} · {s.duration_minutes}min</span>
            <span className="flex items-center gap-1.5 text-white/40 text-sm"><MapPin size={13}/>{s.venue}</span>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="page-title mb-1">My Schedule</h1>
      <p className="text-white/30 text-sm mb-6">Sessions for {category}</p>
      <h2 className="section-title mb-3">Upcoming</h2>
      {!sessions.length ? <div className="card p-8 text-center text-white/30 mb-6"><Calendar size={36} className="mx-auto mb-3 opacity-30"/><p>No upcoming sessions</p></div>
        : <div className="space-y-3 mb-8">{sessions.map((s,i) => <SessionTile key={s.id} s={s} isNext={i===0}/>)}</div>}
      {!!past.length && (<><h2 className="section-title mb-3">Past</h2><div className="space-y-3">{past.map(s => <SessionTile key={s.id} s={s}/>)}</div></>)}
    </div>
  )
}
