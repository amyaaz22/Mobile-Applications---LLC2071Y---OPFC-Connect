'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import PassCard from '@/components/cards/PassCard'
import { categoryColor, formatDate, getAge, getCurrentMonth } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Edit3, Save } from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'

const STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const
const STAT_LABELS: Record<string, string> = {
  pac: 'PAC — Pace', sho: 'SHO — Shooting', pas: 'PAS — Passing',
  dri: 'DRI — Dribbling', def: 'DEF — Defending', phy: 'PHY — Physical'
}

export default function PlayerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [player, setPlayer] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [editStats, setEditStats] = useState(false)
  const [draftStats, setDraftStats] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [attitude, setAttitude] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [attendance, setAttendance] = useState<any[]>([])

  useEffect(() => {
    fetchPlayer()
  }, [params.id])

  async function fetchPlayer() {
    const { data: p } = await supabase
      .from('players')
      .select(`*, guardian:guardians(*), stats:player_stats(*), payments(*)`)
      .eq('id', params.id as string)
      .single()

    if (!p) { router.push('/coach/players'); return }
    setPlayer(p)

    // Get latest stats
    const latestStats = p.stats?.sort((a: any, b: any) =>
      b.assessed_month.localeCompare(a.assessed_month))[0] ?? null
    setStats(latestStats)
    setDraftStats(latestStats
      ? { pac: latestStats.pac, sho: latestStats.sho, pas: latestStats.pas, dri: latestStats.dri, def: latestStats.def, phy: latestStats.phy }
      : { pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 })
    setNotes(latestStats?.coach_notes ?? '')
    setAttitude(latestStats?.attitude ?? '')

    // Generate QR
    const qrData = `opfc://player/${p.id}`
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      color: { dark: '#4EC6C6', light: '#0D1B2A' }, width: 200, margin: 2
    })
    setQrUrl(qrDataUrl)

    // Get attendance
    const { data: att } = await supabase
      .from('attendance')
      .select('*, session:training_sessions(title, date, session_type)')
      .eq('player_id', params.id as string)
      .order('scanned_at', { ascending: false })
      .limit(10)
    setAttendance(att ?? [])
  }

  async function saveStats() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('player_stats').upsert({
      player_id: params.id,
      ...draftStats,
      coach_notes: notes,
      attitude,
      assessed_month: getCurrentMonth(),
      assessed_by: user?.id,
    }, { onConflict: 'player_id,assessed_month' })

    if (error) { toast.error('Failed to save stats: ' + error.message); setSaving(false); return }
    toast.success('Stats saved!')
    setEditStats(false)
    setSaving(false)
    fetchPlayer()
  }

  async function downloadAttendanceCard() {
    if (!qrUrl) return
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ unit: 'mm', format: [85, 55] })
    pdf.setFillColor(13, 27, 42)
    pdf.rect(0, 0, 85, 55, 'F')
    pdf.addImage(qrUrl, 'PNG', 5, 5, 30, 30)
    pdf.setTextColor(78, 198, 198)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'bold')
    pdf.text(player?.full_name?.toUpperCase() ?? '', 38, 12)
    pdf.setFontSize(8)
    pdf.setTextColor(255, 255, 255)
    pdf.text(player?.player_code ?? '', 38, 18)
    pdf.text(player?.category ?? '', 38, 24)
    pdf.setFontSize(7)
    pdf.setTextColor(100, 150, 150)
    pdf.text('Oasis Pailles Football Club', 38, 32)
    pdf.text('Scan at each training session', 38, 37)
    pdf.setFontSize(6)
    pdf.text('OPFC Connect — Omnis Tactus, Officium', 5, 50)
    pdf.save(`OPFC_AttCard_${player?.player_code}.pdf`)
  }

  if (!player) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  const attendanceRate = attendance.length > 0
    ? Math.round(100 * attendance.filter(a => a.status === 'present').length / attendance.length)
    : 0

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link href="/coach/players" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> All Players
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pass Card (front + back PDF) */}
        <div className="flex flex-col items-center gap-4">
          <PassCard player={player} qrUrl={qrUrl}/>
        </div>

        {/* Middle: Info + Stats */}
        <div className="lg:col-span-2 space-y-5">
          {/* Player info */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-2xl font-black font-condensed text-white">{player.full_name}</h1>
                <span className={`badge mt-1 ${categoryColor(player.category)}`}>{player.category} · {player.position}</span>
              </div>
              <Link href={`/coach/players/${player.id}/edit`} className="btn-secondary flex items-center gap-2 text-sm">
                <Edit3 size={14}/> Edit
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Date of Birth', formatDate(player.date_of_birth)],
                ['Age', `${getAge(player.date_of_birth)} years`],
                ['Nationality', player.nationality],
                ['School', player.school ?? '—'],
                ['Player Code', player.player_code],
                ['Attendance', `${attendanceRate}%`],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="label">{label}</p>
                  <p className="text-white text-sm font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {player.medical_notes && (
              <div className="mt-4 p-3 bg-amber-400/10 border border-amber-400/20 rounded-xl">
                <p className="text-amber-300 text-xs font-bold">⚠ Medical Notes</p>
                <p className="text-white/70 text-sm mt-1">{player.medical_notes}</p>
              </div>
            )}
          </div>

          {/* Guardian */}
          {player.guardian && (
            <div className="card p-5">
              <h2 className="section-title mb-3">Guardian</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['Name', player.guardian.full_name],
                  ['Relationship', player.guardian.relationship],
                  ['Phone (Primary)', player.guardian.phone_primary],
                  ['Phone (Secondary)', player.guardian.phone_secondary ?? '—'],
                  ['Email', player.guardian.email ?? '—'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="label">{label}</p>
                    <p className="text-white text-sm font-medium mt-0.5">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stats editor */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Monthly Ratings — {new Date().toLocaleDateString('en', { month: 'long', year: 'numeric' })}</h2>
              {!editStats && (
                <button onClick={() => setEditStats(true)}
                  className="btn-secondary flex items-center gap-2 text-sm">
                  <Edit3 size={14}/> Edit Stats
                </button>
              )}
            </div>

            {editStats ? (
              <div className="space-y-4">
                {STAT_KEYS.map(key => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="label">{STAT_LABELS[key]}</label>
                      <span className="text-teal-400 font-bold text-sm">{draftStats[key]}</span>
                    </div>
                    <input
                      type="range" min={1} max={99}
                      value={draftStats[key]}
                      onChange={e => setDraftStats(d => ({ ...d, [key]: +e.target.value }))}
                      className="w-full accent-teal-400"
                    />
                  </div>
                ))}
                <div className="p-3 bg-teal-400/5 border border-teal-400/10 rounded-xl text-center">
                  <p className="text-white/40 text-xs">Overall Rating</p>
                  <p className="text-4xl font-black font-condensed text-teal-400">
                    {Math.round((Object.values(draftStats).reduce((a:number,b:any)=>a+b,0))/6)}
                  </p>
                </div>
                <div>
                  <label className="label mb-1.5 block">Coach Notes</label>
                  <textarea className="input resize-none" rows={3} value={notes}
                    onChange={e => setNotes(e.target.value)} placeholder="Performance notes…"/>
                </div>
                <div>
                  <label className="label mb-1.5 block">Attitude</label>
                  <input className="input" value={attitude} onChange={e => setAttitude(e.target.value)}
                    placeholder="e.g. Excellent, Good, Needs improvement"/>
                </div>
                <div className="flex gap-3">
                  <button onClick={saveStats} disabled={saving}
                    className="btn-primary flex items-center gap-2 flex-1">
                    <Save size={16}/>{saving ? 'Saving…' : 'Save Ratings'}
                  </button>
                  <button onClick={() => setEditStats(false)} className="btn-secondary">Cancel</button>
                </div>
              </div>
            ) : (
              stats ? (
                <div className="space-y-3">
                  {STAT_KEYS.map(key => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-white/40 w-8">{key.toUpperCase()}</span>
                      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-teal-400 rounded-full" style={{ width: `${stats[key]}%` }}/>
                      </div>
                      <span className="text-sm font-bold text-white w-6 text-right">{stats[key]}</span>
                    </div>
                  ))}
                  {stats.coach_notes && (
                    <div className="mt-3 p-3 bg-white/3 rounded-xl">
                      <p className="label mb-1">Coach Notes</p>
                      <p className="text-white/70 text-sm">{stats.coach_notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-white/30">
                  <p className="text-sm">No ratings for this month yet.</p>
                  <button onClick={() => setEditStats(true)} className="btn-primary mt-3 text-sm">Add Ratings</button>
                </div>
              )
            )}
          </div>

          {/* Attendance history */}
          <div className="card p-5">
            <h2 className="section-title mb-3">Recent Attendance</h2>
            {attendance.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">No attendance records yet</p>
            ) : (
              <div className="space-y-2">
                {attendance.map(a => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-white text-sm font-medium">{(a.session as any)?.title}</p>
                      <p className="text-white/30 text-xs">{formatDate((a.session as any)?.date)}</p>
                    </div>
                    <span className={`badge text-xs ${a.status === 'present' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
