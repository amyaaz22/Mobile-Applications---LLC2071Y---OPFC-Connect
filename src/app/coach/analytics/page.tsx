'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend, RadarChart,
  PolarGrid, PolarAngleAxis, Radar
} from 'recharts'
import { Users, TrendingUp, Wallet, CalendarDays, Award, Activity } from 'lucide-react'
import { formatDate } from '@/lib/utils'

// ── Custom tooltip ────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#112233] border border-white/10 rounded-xl px-3 py-2 text-sm shadow-xl">
      {label && <p className="text-white/50 text-xs mb-1">{label}</p>}
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color ?? '#4EC6C6' }} className="font-semibold">
          {p.name ? `${p.name}: ` : ''}{p.value}{p.unit ?? ''}
        </p>
      ))}
    </div>
  )
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400 mb-4">{children}</h2>
)

const StatCard = ({ label, value, sub, icon, color }: any) => (
  <div className="card p-5 flex items-center justify-between">
    <div>
      <p className="text-white/40 text-sm">{label}</p>
      <p className="text-3xl font-black font-condensed text-white mt-1">{value}</p>
      {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
    </div>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      {icon}
    </div>
  </div>
)

// ── Day labels ────────────────────────────────────────────────
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AnalyticsDashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)

    // ── Raw data fetches ────────────────────────────────────
    const [
      { data: players },
      { data: sessions },
      { data: attendance },
      { data: payments },
      { data: stats },
      { data: announcements },
    ] = await Promise.all([
      supabase.from('players').select('id, full_name, category, is_active, created_at'),
      supabase.from('training_sessions').select('id, date, category, session_type, status'),
      supabase.from('attendance').select('id, player_id, session_id, status, scanned_at'),
      supabase.from('payments').select('id, player_id, type, month, amount, status, confirmed_at'),
      supabase.from('player_stats').select('player_id, ovr, assessed_month'),
      supabase.from('announcements').select('id, title, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    const activePlayers = players?.filter((p: any) => p.is_active) ?? []
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // ── 1. Category breakdown ────────────────────────────────
    const categoryCount: Record<string, number> = {}
    activePlayers.forEach((p: any) => {
      categoryCount[p.category] = (categoryCount[p.category] ?? 0) + 1
    })
    const categoryData = Object.entries(categoryCount).map(([name, count]) => ({ name, count }))

    // ── 2. Monthly attendance rate (last 6 months) ───────────
    const monthlyAttendance: Record<string, { present: number; total: number }> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyAttendance[key] = { present: 0, total: 0 }
    }
    attendance?.forEach((a: any) => {
      const month = a.scanned_at?.slice(0, 7)
      if (month && monthlyAttendance[month] !== undefined) {
        monthlyAttendance[month].total++
        if (a.status === 'present') monthlyAttendance[month].present++
      }
    })
    const attendanceTrend = Object.entries(monthlyAttendance).map(([month, { present, total }]) => ({
      label: new Date(`${month}-01`).toLocaleDateString('en', { month: 'short' }),
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      present,
      total,
    }))

    // ── 3. Payment collection ────────────────────────────────
    const monthlyPayments = payments?.filter((p: any) => p.type === 'monthly') ?? []
    const paid = monthlyPayments.filter((p: any) => p.status === 'paid' && p.month === currentMonth)
    const pending = monthlyPayments.filter((p: any) => p.status !== 'paid' && p.month === currentMonth)
    const totalCollected = paid.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0)
    const paymentData = [
      { name: 'Paid', value: paid.length, color: '#4EC6C6' },
      { name: 'Pending', value: activePlayers.length - paid.length, color: 'rgba(255,255,255,0.1)' },
    ]

    // ── 4. Attendance heatmap by day of week ─────────────────
    const dayCount: Record<number, { present: number; total: number }> = {}
    for (let i = 0; i < 7; i++) dayCount[i] = { present: 0, total: 0 }
    attendance?.forEach((a: any) => {
      if (!a.scanned_at) return
      const day = new Date(a.scanned_at).getDay()
      dayCount[day].total++
      if (a.status === 'present') dayCount[day].present++
    })
    const heatmapData = Object.entries(dayCount).map(([day, { present, total }]) => ({
      day: DAY_LABELS[Number(day)],
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
      count: total,
    })).filter(d => d.count > 0)

    // ── 5. Category attendance rate comparison ───────────────
    const catAttendance: Record<string, { present: number; total: number }> = {}
    const sessionCategory: Record<string, string> = {}
    sessions?.forEach((s: any) => { sessionCategory[s.id] = s.category })
    attendance?.forEach((a: any) => {
      const cat = sessionCategory[a.session_id] ?? 'Unknown'
      if (!catAttendance[cat]) catAttendance[cat] = { present: 0, total: 0 }
      catAttendance[cat].total++
      if (a.status === 'present') catAttendance[cat].present++
    })
    const categoryAttendance = Object.entries(catAttendance)
      .filter(([cat]) => cat !== 'Unknown' && cat !== 'All')
      .map(([category, { present, total }]) => ({
        category,
        rate: total > 0 ? Math.round((present / total) * 100) : 0,
      }))

    // ── 6. Top 5 attenders ───────────────────────────────────
    const playerAttendance: Record<string, { name: string; present: number; total: number }> = {}
    const playerMap: Record<string, string> = {}
    activePlayers.forEach((p: any) => { playerMap[p.id] = p.full_name })
    attendance?.forEach((a: any) => {
      const name = playerMap[a.player_id]
      if (!name) return
      if (!playerAttendance[a.player_id]) playerAttendance[a.player_id] = { name, present: 0, total: 0 }
      playerAttendance[a.player_id].total++
      if (a.status === 'present') playerAttendance[a.player_id].present++
    })
    const topAttenders = Object.values(playerAttendance)
      .map(p => ({ ...p, rate: p.total > 0 ? Math.round((p.present / p.total) * 100) : 0 }))
      .sort((a, b) => b.rate - a.rate)
      .slice(0, 5)

    // ── 7. Fee collection timeline (last 6 months) ───────────
    const feeTimeline: Record<string, number> = {}
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      feeTimeline[key] = 0
    }
    payments?.filter((p: any) => p.status === 'paid').forEach((p: any) => {
      const month = p.month ?? p.confirmed_at?.slice(0, 7)
      if (month && feeTimeline[month] !== undefined) {
        feeTimeline[month] += p.amount ?? 0
      }
    })
    const feeTrend = Object.entries(feeTimeline).map(([month, amount]) => ({
      label: new Date(`${month}-01`).toLocaleDateString('en', { month: 'short' }),
      amount,
    }))

    // ── 8. Recent activity ───────────────────────────────────
    const recentScans = attendance
      ?.filter((a: any) => a.scanned_at)
      .sort((a: any, b: any) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime())
      .slice(0, 5)
      .map((a: any) => ({
        type: 'scan',
        text: `${playerMap[a.player_id] ?? 'Unknown'} checked in`,
        time: a.scanned_at,
      })) ?? []

    const recentPayments = payments
      ?.filter((p: any) => p.status === 'paid' && p.confirmed_at)
      .sort((a: any, b: any) => new Date(b.confirmed_at).getTime() - new Date(a.confirmed_at).getTime())
      .slice(0, 3)
      .map((p: any) => ({
        type: 'payment',
        text: `Fee confirmed — Rs ${p.amount}`,
        time: p.confirmed_at,
      })) ?? []

    const recentAnnouncements = (announcements ?? []).slice(0, 2).map((a: any) => ({
      type: 'announcement',
      text: `Announcement: ${a.title}`,
      time: a.created_at,
    }))

    const recentActivity = [...recentScans, ...recentPayments, ...recentAnnouncements]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 8)

    // ── 9. Session type breakdown ─────────────────────────────
    const sessionTypes: Record<string, number> = {}
    sessions?.forEach((s: any) => {
      sessionTypes[s.session_type] = (sessionTypes[s.session_type] ?? 0) + 1
    })
    const sessionTypeData = Object.entries(sessionTypes).map(([type, count]) => ({ type, count }))

    // ── Overall stats ─────────────────────────────────────────
    const overallAttendanceRate = (() => {
      const total = attendance?.length ?? 0
      const present = attendance?.filter((a: any) => a.status === 'present').length ?? 0
      return total > 0 ? Math.round((present / total) * 100) : 0
    })()

    setData({
      activePlayers: activePlayers.length,
      totalSessions: sessions?.length ?? 0,
      overallAttendanceRate,
      totalCollected,
      categoryData,
      attendanceTrend,
      paymentData,
      paidCount: paid.length,
      totalActive: activePlayers.length,
      heatmapData,
      categoryAttendance,
      topAttenders,
      feeTrend,
      recentActivity,
      sessionTypeData,
    })
    setLoading(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div className="flex items-center gap-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ width: 24, height: 24, border: '2px solid rgba(78,198,198,0.3)', borderTop: '2px solid #4EC6C6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}/>
        <span>Loading analytics…</span>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const {
    activePlayers, totalSessions, overallAttendanceRate, totalCollected,
    categoryData, attendanceTrend, paymentData, paidCount, totalActive,
    heatmapData, categoryAttendance, topAttenders, feeTrend,
    recentActivity, sessionTypeData,
  } = data

  const CATEGORY_PALETTE = ['#f97316', '#a855f7', '#4EC6C6', '#f5a623', '#38bdf8', '#f472b6']
  const categoryOrder: string[] = (categoryData ?? []).map((c: any) => c.name ?? c.category)
  function categoryColorFor(name: string) {
    const i = categoryOrder.indexOf(name)
    return CATEGORY_PALETTE[i >= 0 ? i % CATEGORY_PALETTE.length : 0]
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black font-condensed text-white">Analytics</h1>
        <p className="text-white/30 text-sm mt-1">Club performance overview — {new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}</p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Players" value={activePlayers} icon={<Users size={20}/>} color="bg-teal-400/10 text-teal-400"/>
        <StatCard label="Total Sessions" value={totalSessions} icon={<CalendarDays size={20}/>} color="bg-blue-400/10 text-blue-400"/>
        <StatCard label="Attendance Rate" value={`${overallAttendanceRate}%`} sub="All time" icon={<TrendingUp size={20}/>} color="bg-green-400/10 text-green-400"/>
        <StatCard label="Fees Collected" value={`Rs ${totalCollected.toLocaleString()}`} sub="All confirmed" icon={<Wallet size={20}/>} color="bg-amber-400/10 text-amber-400"/>
      </div>

      {/* Row 1: Attendance trend + Category breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card p-5">
          <SectionTitle>Monthly Attendance Rate</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={attendanceTrend}>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%"/>
              <Tooltip content={<ChartTooltip/>}/>
              <Line type="monotone" dataKey="rate" stroke="#4EC6C6" strokeWidth={2.5} dot={{ fill: '#4EC6C6', r: 4 }} activeDot={{ r: 6 }} name="Rate" unit="%"/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <SectionTitle>Players by Category</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData} layout="vertical">
              <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }} axisLine={false} tickLine={false} width={70}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Players">
                {categoryData.map((entry: any) => (
                  <Cell key={entry.name} fill={categoryColorFor(entry.name)}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Fee timeline + Payment donut + Category attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 card p-5">
          <SectionTitle>Monthly Fee Collection (Rs)</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={feeTrend}>
              <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip/>}/>
              <Bar dataKey="amount" radius={[6, 6, 0, 0]} name="Rs">
                {feeTrend.map((_: any, i: number) => (
                  <Cell key={i} fill={i === feeTrend.length - 1 ? '#4EC6C6' : 'rgba(78,198,198,0.4)'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <SectionTitle>This Month's Fees</SectionTitle>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={paymentData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                {paymentData.map((entry: any, i: number) => (
                  <Cell key={i} fill={entry.color}/>
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-around mt-2">
            <div className="text-center">
              <div className="text-2xl font-black font-condensed text-teal-400">{paidCount}</div>
              <div className="text-white/30 text-xs">Paid</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black font-condensed text-white/40">{totalActive - paidCount}</div>
              <div className="text-white/30 text-xs">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Day heatmap + Category attendance comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <SectionTitle>Attendance by Day of Week</SectionTitle>
          {heatmapData.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No attendance data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={heatmapData}>
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false}/>
                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} unit="%"/>
                <Tooltip content={<ChartTooltip/>}/>
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} name="Attendance" unit="%" fill="#4EC6C6"/>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-5">
          <SectionTitle>Attendance Rate by Category</SectionTitle>
          {categoryAttendance.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-4 pt-2">
              {categoryAttendance.map((cat: any) => (
                <div key={cat.category}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-white text-sm font-semibold">{cat.category}</span>
                    <span className="text-teal-400 font-bold text-sm">{cat.rate}%</span>
                  </div>
                  <div className="h-2.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${cat.rate}%`,
                        background: categoryColorFor(cat.category)
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Top attenders + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <SectionTitle>🏆 Top Attenders</SectionTitle>
          {topAttenders.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No attendance data yet</p>
          ) : (
            <div className="space-y-3">
              {topAttenders.map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-black text-xs
                    ${i === 0 ? 'bg-amber-400 text-navy-900' : i === 1 ? 'bg-gray-400 text-navy-900' : i === 2 ? 'bg-orange-700 text-white' : 'bg-white/10 text-white/50'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white text-sm font-medium">{p.name}</span>
                      <span className="text-teal-400 text-sm font-bold">{p.rate}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-teal-400 rounded-full" style={{ width: `${p.rate}%` }}/>
                    </div>
                  </div>
                  <span className="text-white/25 text-xs">{p.present}/{p.total}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <SectionTitle>Recent Activity</SectionTitle>
          {recentActivity.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((item: any, i: number) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0
                    ${item.type === 'scan' ? 'bg-green-400'
                    : item.type === 'payment' ? 'bg-teal-400'
                    : 'bg-purple-400'}`}/>
                  <div className="flex-1">
                    <p className="text-white text-sm">{item.text}</p>
                    <p className="text-white/25 text-xs mt-0.5">
                      {new Date(item.time).toLocaleDateString('en', { day: 'numeric', month: 'short' })} · {new Date(item.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Session type breakdown */}
      {sessionTypeData.length > 0 && (
        <div className="card p-5">
          <SectionTitle>Sessions by Type</SectionTitle>
          <div className="flex gap-6">
            {sessionTypeData.map((s: any) => (
              <div key={s.type} className="flex items-center gap-3">
                <span className="text-2xl">{s.type === 'match' ? '⚽' : s.type === 'tournament' ? '🏆' : '🏃'}</span>
                <div>
                  <div className="text-2xl font-black font-condensed text-white">{s.count}</div>
                  <div className="text-white/30 text-xs capitalize">{s.type}s</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
