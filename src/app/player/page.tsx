'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PlayerCard from '@/components/cards/PlayerCard'
import { formatDate, paymentStatusColor, getCurrentMonth } from '@/lib/utils'
import { CreditCard } from 'lucide-react'

export default function PlayerDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      const { data: player } = await supabase.from('players').select('*, stats:player_stats(*)').eq('profile_id', user.id).single()
      const stats = (player as any)?.stats?.sort((a: any, b: any) => b.assessed_month.localeCompare(a.assessed_month))[0] ?? null

      const [{ data: sessions }, { data: announcements }, { data: attendance }, { data: payment }] = await Promise.all([
        supabase.from('training_sessions').select('*').gte('date', new Date().toISOString().split('T')[0]).or(`category.eq.${(player as any)?.category ?? 'First Team'},category.eq.All`).order('date').limit(4),
        supabase.from('announcements').select('*').or(`target_category.eq.All,target_category.eq.${(player as any)?.category ?? 'First Team'}`).order('created_at', { ascending: false }).limit(3),
        supabase.from('attendance').select('*').eq('player_id', (player as any)?.id ?? ''),
        supabase.from('payments').select('*').eq('player_id', (player as any)?.id ?? '').eq('month', getCurrentMonth()).single(),
      ])

      const presentCount = attendance?.filter((a: any) => a.status === 'present').length ?? 0
      const totalCount = attendance?.length ?? 0
      const attendanceRate = totalCount > 0 ? Math.round(100 * presentCount / totalCount) : 0

      setData({ profile, player, stats, sessions, announcements, attendanceRate, presentCount, totalCount, payment })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid rgba(78,198,198,0.3)', borderTop: '2px solid #4EC6C6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}/>
        <span>Loading…</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const { profile, player, stats, sessions, announcements, attendanceRate, presentCount, totalCount, payment } = data
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-teal-400 text-sm font-semibold">{greeting}</p>
        <h1 className="text-3xl font-black font-condensed text-white mt-1">{profile?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-white/30 text-sm mt-1">{formatDate(new Date().toISOString())} · Player Portal</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="flex flex-col items-center gap-4">
          {player ? (
            <>
              <PlayerCard player={player as any} stats={stats} showDownload/>
              <Link href="/player/card" className="btn-secondary w-full text-center text-sm">View Full Card</Link>
            </>
          ) : (
            <div className="card p-8 text-center text-white/30 w-full">
              <CreditCard size={40} className="mx-auto mb-3 opacity-30"/>
              <p className="text-sm">No player profile linked.</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-4 text-center">
              <div className="text-3xl font-black font-condensed text-teal-400">{attendanceRate}%</div>
              <div className="text-white/40 text-xs mt-1">Attendance Rate</div>
              <div className="text-white/20 text-xs">{presentCount}/{totalCount} sessions</div>
            </div>
            <div className="card p-4 text-center">
              <div className={`text-3xl font-black font-condensed ${payment?.status === 'paid' ? 'text-green-400' : 'text-amber-400'}`}>
                {payment?.status === 'paid' ? '✓' : '!'}
              </div>
              <div className="text-white/40 text-xs mt-1">Fee Status</div>
              <div className={`badge mt-1 mx-auto inline-block ${paymentStatusColor(payment?.status ?? 'pending')}`}>
                {payment?.status ?? 'pending'}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="section-title mb-4">Upcoming Sessions</h2>
            {!sessions?.length ? (
              <p className="text-white/30 text-sm text-center py-4">No upcoming sessions</p>
            ) : sessions.map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
                <div className="w-10 h-10 rounded-lg bg-teal-400/10 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-teal-400 font-bold text-[9px]">{new Date(s.date).toLocaleDateString('en',{weekday:'short'}).toUpperCase()}</span>
                  <span className="text-white font-black text-sm">{new Date(s.date).getDate()}</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{s.title}</p>
                  <p className="text-white/40 text-xs">{s.time_start?.slice(0,5)} · {s.venue}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h2 className="section-title mb-4">Announcements</h2>
            {!announcements?.length ? (
              <p className="text-white/30 text-sm text-center py-4">No announcements</p>
            ) : announcements.map((a: any) => (
              <div key={a.id} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.is_urgent ? 'bg-red-400' : 'bg-teal-400'}`}/>
                <div>
                  <p className="text-white font-semibold text-sm">{a.title}</p>
                  <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{a.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
