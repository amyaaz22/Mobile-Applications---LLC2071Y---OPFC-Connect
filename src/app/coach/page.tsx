'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Users, CalendarDays, Wallet, QrCode, ChevronRight, PiggyBank, Package, ShieldCheck, AlertTriangle } from 'lucide-react'
import { formatDate, categoryColor, getCurrentMonth } from '@/lib/utils'

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
        { data: monthPayments },
        { data: announcements },
        { data: recentAttendance },
      ] = await Promise.all([
        supabase.from('profiles').select('full_name, role').eq('id', user.id).single(),
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('training_sessions').select('*').gte('date', new Date().toISOString().split('T')[0]).order('date').limit(3),
        supabase.from('payments').select('player_id, status, type').eq('status', 'paid').eq('type', 'monthly').eq('month', getCurrentMonth()),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
        supabase.from('attendance').select('*, player:players(full_name), session:training_sessions(title, date)').order('scanned_at', { ascending: false }).limit(5),
      ])

      // A payment row only exists once someone has touched it — so "pending"
      // is every active player who hasn't been marked paid this month, not
      // just players with an explicit pending row.
      const paidThisMonth = new Set((monthPayments ?? []).map(p => p.player_id))
      const pendingPayments = Math.max((playerCount ?? 0) - paidThisMonth.size, 0)

      let admin: any = null
      if (profile?.role === 'admin') {
        const [
          { data: paidPayments }, { data: incomeRows }, { data: expenseRows },
          { data: inventoryRows }, { count: staffCount }, { count: entryOutstanding }, { data: players },
        ] = await Promise.all([
          supabase.from('payments').select('amount').eq('status', 'paid'),
          supabase.from('income').select('amount'),
          supabase.from('expenses').select('amount'),
          supabase.from('inventory_items').select('quantity, min_stock'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['admin', 'coach']),
          supabase.from('payments').select('*', { count: 'exact', head: true }).eq('type', 'entry').eq('status', 'pending'),
          supabase.from('players').select('category').eq('is_active', true),
        ])
        const balance = (paidPayments ?? []).reduce((s, p) => s + p.amount, 0)
          + (incomeRows ?? []).reduce((s, i) => s + i.amount, 0)
          - (expenseRows ?? []).reduce((s, e) => s + e.amount, 0)
        const lowStockCount = (inventoryRows ?? []).filter((i: any) => i.quantity <= (i.min_stock ?? 0)).length
        const byCategory: Record<string, number> = {}
        ;(players ?? []).forEach((p: any) => { byCategory[p.category] = (byCategory[p.category] ?? 0) + 1 })
        admin = { balance, staffCount: staffCount ?? 0, entryOutstanding: entryOutstanding ?? 0, lowStockCount, byCategory }
      }

      setData({ profile, playerCount, sessions, pendingPayments, announcements, recentAttendance, admin })
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

  const { profile, playerCount, sessions, pendingPayments, announcements, recentAttendance, admin } = data
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

      {/* Admin bird's-eye overview */}
      {admin && (
        <div className="card p-5 mb-8 border-teal-400/15 bg-teal-400/3">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck size={16} className="text-teal-400"/>
            <h2 className="section-title mb-0">Club Overview</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Link href="/coach/finance" className="p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className={`text-2xl font-black font-condensed ${admin.balance >= 0 ? 'text-teal-400' : 'text-red-400'}`}>Rs {admin.balance.toLocaleString()}</div>
              <div className="text-white/40 text-xs mt-1 flex items-center gap-1"><PiggyBank size={12}/> Club balance</div>
            </Link>
            <Link href="/coach/payments" className="p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className="text-2xl font-black font-condensed text-amber-400">{admin.entryOutstanding}</div>
              <div className="text-white/40 text-xs mt-1 flex items-center gap-1"><Wallet size={12}/> Entry fees outstanding</div>
            </Link>
            <Link href="/coach/inventory" className="p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className={`text-2xl font-black font-condensed flex items-center gap-1.5 ${admin.lowStockCount > 0 ? 'text-red-400' : 'text-white'}`}>
                {admin.lowStockCount > 0 && <AlertTriangle size={18}/>}{admin.lowStockCount}
              </div>
              <div className="text-white/40 text-xs mt-1 flex items-center gap-1"><Package size={12}/> Low-stock items</div>
            </Link>
            <Link href="/coach/staff" className="p-3 rounded-xl hover:bg-white/5 transition-colors">
              <div className="text-2xl font-black font-condensed text-white">{admin.staffCount}</div>
              <div className="text-white/40 text-xs mt-1 flex items-center gap-1"><ShieldCheck size={12}/> Coaches &amp; admins</div>
            </Link>
          </div>
          {Object.keys(admin.byCategory).length > 0 && (
            <div className="flex gap-2 flex-wrap pt-3 border-t border-white/5">
              {Object.entries(admin.byCategory).map(([cat, count]) => (
                <span key={cat} className="badge bg-white/5 text-white/50 border-white/10 text-xs">{cat}: {count as number}</span>
              ))}
            </div>
          )}
        </div>
      )}

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
