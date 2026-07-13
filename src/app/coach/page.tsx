'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Users, CalendarDays, Wallet, QrCode, ChevronRight } from 'lucide-react'
import { formatDate, categoryColor } from '@/lib/utils'

export default function CoachDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [
        { data: profile },
        { count: playerCount },
        { data: sessions },
        { count: pendingPayments },
        { data: announcements },
        { data: recentAttendance },
      ] = await Promise.all([
        supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('training_sessions').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date').limit(3),
        supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('attendance').select('*, player:players(full_name), session:training_sessions(title, date)').order('scanned_at', { ascending: false }).limit(5),
      ])

      setData({ profile, playerCount, sessions, pendingPayments, announcements, recentAttendance })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid rgba(78,198,198,0.3)', borderTop: '2px solid #4EC6C6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}/>
        <span>Loading dashboard…</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const { profile, playerCount, sessions, pendingPayments, announcements, recentAttendance } = data
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'Coach'

  const stats = [
    { label: 'Active Players', value: playerCount ?? 0, icon: <Users size={20}/>, href: '/coach/players', color: 'teal' },
    { label: 'Upcoming Sessions', value: sessions?.length ?? 0, icon: <CalendarDays size={20}/>, href: '/coach/sessions', color: 'blue' },
    { label: 'Pending Fees', value: pendingPayments ?? 0, icon: <Wallet size={20}/>, href: '/coach/payments', color: 'amber' },
  ]

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-teal-400 text-sm font-semibold">{greeting}</p>
        <h1 className="text-3xl font-black font-condensed text-white mt-1">
          {profile?.role === 'admin' ? 'Admin' : 'Coach'} {firstName} 👋
        </h1>
        <p className="text-white/30 text-sm mt-1">{formatDate(new Date().toISOString())}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon, href, color }) => (
          <Link key={label} href={href} className="card-hover p-5 flex items-center justify-between group">
            <div>
              <p className="text-white/40 text-sm">{label}</p>
              <p className="text-3xl font-black font-condensed text-white mt-1">{value}</p>
            </div>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center
              ${color === 'teal' ? 'bg-teal-400/10 text-teal-400'
                : color === 'blue' ? 'bg-blue-400/10 text-blue-400'
                : 'bg-amber-400/10 text-amber-400'}`}>
              {icon}
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Upcoming Sessions</h2>
            <Link href="/coach/sessions" className="text-teal-400 text-xs hover:underline">View all</Link>
          </div>
          {!sessions?.length ? (
            <p className="text-white/30 text-sm text-center py-6">No upcoming sessions</p>
          ) : sessions.map((s: any) => (
            <div key={s.id} className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
              <div className="w-10 h-10 rounded-lg bg-teal-400/10 flex flex-col items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold text-[9px]">
                  {new Date(s.date).toLocaleDateString('en', { weekday: 'short' }).toUpperCase()}
                </span>
                <span className="text-white font-black text-sm">{new Date(s.date).getDate()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{s.title}</p>
                <p className="text-white/40 text-xs">{s.time_start?.slice(0,5)} · {s.venue}</p>
              </div>
              <span className={`badge text-xs ${categoryColor(s.category)}`}>{s.category}</span>
            </div>
          ))}
        </div>

        <div className="card p-5">
          <h2 className="section-title mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { href: '/scan', label: 'Open QR Scanner', sub: 'Mark attendance at training', icon: <QrCode size={18}/>, primary: true },
              { href: '/coach/players/new', label: 'Add New Player', sub: 'Register a player', icon: <Users size={18}/> },
              { href: '/coach/sessions/new', label: 'Create Session', sub: 'Schedule training or match', icon: <CalendarDays size={18}/> },
              { href: '/coach/payments', label: 'Review Payments', sub: `${pendingPayments ?? 0} pending`, icon: <Wallet size={18}/> },
            ].map(({ href, label, sub, icon, primary }) => (
              <Link key={href} href={href}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all
                  ${primary ? 'bg-teal-400/10 border border-teal-400/20 hover:bg-teal-400/20' : 'hover:bg-white/5'}`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0
                  ${primary ? 'bg-teal-400/20 text-teal-400' : 'bg-white/5 text-white/50'}`}>
                  {icon}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${primary ? 'text-teal-400' : 'text-white'}`}>{label}</p>
                  <p className="text-white/30 text-xs">{sub}</p>
                </div>
                <ChevronRight size={14} className="text-white/20"/>
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title">Announcements</h2>
            <Link href="/coach/announcements" className="text-teal-400 text-xs hover:underline">Manage</Link>
          </div>
          {!announcements?.length ? (
            <p className="text-white/30 text-sm text-center py-6">No announcements</p>
          ) : announcements.map((a: any) => (
            <div key={a.id} className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.is_urgent ? 'bg-red-400' : 'bg-teal-400'}`}/>
              <div className="flex-1">
                <p className="text-white font-semibold text-sm">{a.title}</p>
                <p className="text-white/30 text-xs mt-0.5">{a.tag} · {formatDate(a.created_at)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="card p-5">
          <h2 className="section-title mb-4">Recent Check-ins</h2>
          {!recentAttendance?.length ? (
            <p className="text-white/30 text-sm text-center py-6">No recent check-ins</p>
          ) : recentAttendance.map((a: any) => (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
              <div className="w-8 h-8 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 font-bold text-xs">{a.player?.full_name?.[0]?.toUpperCase()}</span>
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{a.player?.full_name}</p>
                <p className="text-white/30 text-xs">{a.session?.title}</p>
              </div>
              <span className="text-green-400 text-xs font-semibold">Present</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
