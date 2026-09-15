'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import PassCard from '@/components/cards/PassCard'
import { categoryColor, formatDate, getAge, getCurrentMonth, paymentStatusColor } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Edit3, Save, Trash2, UserCheck } from 'lucide-react'
import Link from 'next/link'
import QRCode from 'qrcode'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { logAudit } from '@/lib/audit'

const STAT_KEYS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const
const STAT_LABELS: Record<string, string> = {
  pac: 'PAC — Pace', sho: 'SHO — Shooting', pas: 'PAS — Passing',
  dri: 'DRI — Dribbling', def: 'DEF — Defending', phy: 'PHY — Physical'
}

export default function PlayerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const permitted = usePermissionGuard('players')
  const [player, setPlayer] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [editStats, setEditStats] = useState(false)
  const [draftStats, setDraftStats] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [attitude, setAttitude] = useState('')
  const [saving, setSaving] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [attendance, setAttendance] = useState<any[]>([])
  const [clubInfo, setClubInfo] = useState<{ logo_url?: string; name?: string }>({})

  useEffect(() => {
    fetchPlayer()
  }, [params.id])

  useEffect(() => {
    supabase.from('club_settings').select('value').eq('key', 'club_info').single()
      .then(({ data }) => { if (data?.value) setClubInfo(data.value as any) })
  }, [])

  async function fetchPlayer() {
    const { data: p } = await supabase
      .from('players')
      .select(`*, guardian:guardians(*), stats:player_stats(*), payments(*), points:player_points(*, rule:point_rules(name, icon))`)
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

  async function convertToMember() {
    if (!confirm(`Officially onboard ${player.full_name} as a full member? This creates their entry fee.`)) return
    setSaving(true)
    const { error } = await supabase.from('players').update({ enrollment_status: 'active' }).eq('id', params.id as string)
    if (error) { toast.error('Failed to convert: ' + error.message); setSaving(false); return }

    const { data: fees } = await supabase.from('club_settings').select('value').eq('key', 'fees').single()
    const entryFee = (fees?.value as any)?.entry
    if (entryFee) {
      await supabase.from('payments').insert({ player_id: params.id as string, type: 'entry', amount: entryFee, status: 'pending' })
    }

    logAudit(supabase, { action: 'update', entity: 'player', entity_id: params.id as string, summary: `Converted "${player.full_name}" from trial to full member` })
    toast.success(`${player.full_name} is now a full member!`)
    setSaving(false)
    fetchPlayer()
  }

  async function deleteAward(id: string) {
    if (!confirm('Remove this points award? This cannot be undone.')) return
    await supabase.from('player_points').delete().eq('id', id)
    toast.success('Award removed')
    fetchPlayer()
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

  if (!permitted || !player) return (
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

      {player.enrollment_status === 'trial' && (
        <div className="card p-4 mb-6 border-amber-500/20 bg-amber-500/5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-amber-400 text-sm font-bold">Trial Player</p>
            <p className="text-amber-400/70 text-xs mt-0.5">Attending on a trial basis — no entry fee charged yet. Convert once they're ready to officially join.</p>
          </div>
          <button onClick={convertToMember} disabled={saving} className="btn-primary flex items-center gap-2 text-sm flex-shrink-0">
            <UserCheck size={14}/> Convert to Full Member
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Pass Card (front + back PDF) */}
        <div className="flex flex-col items-center gap-4">
          <PassCard player={player} qrUrl={qrUrl} logoUrl={clubInfo.logo_url} clubName={clubInfo.name}
            guardianPhone={(Array.isArray(player.guardian) ? player.guardian[0] : player.guardian)?.phone_primary}/>
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

          {/* Payment history */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Payment History</h2>
              <Link href="/coach/payments" className="text-teal-400 text-xs hover:underline">Record payment →</Link>
            </div>
            {!player.payments?.length ? (
              <p className="text-white/30 text-sm text-center py-4">No payments recorded yet</p>
            ) : (
              <div className="space-y-2">
                {[...player.payments].sort((a: any, b: any) => b.created_at.localeCompare(a.created_at)).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-white text-sm font-medium capitalize">{p.type}{p.month ? ` · ${p.month}` : ''}</p>
                      <p className="text-white/30 text-xs">{formatDate(p.created_at)}{p.method ? ` · ${p.method}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="text-white font-semibold text-sm">Rs {p.amount}</span>
                      <span className={`badge text-xs ${paymentStatusColor(p.status)}`}>{p.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Points history */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Points History</h2>
              <div className="flex items-center gap-3">
                <span className="text-teal-400 font-bold text-sm">
                  {(player.points ?? []).reduce((s: number, a: any) => s + a.points, 0)} pts total
                </span>
                <Link href="/coach/points" className="text-teal-400 text-xs hover:underline">Award points →</Link>
              </div>
            </div>
            {!player.points?.length ? (
              <p className="text-white/30 text-sm text-center py-4">No points awarded yet</p>
            ) : (
              <div className="space-y-2">
                {[...player.points].sort((a: any, b: any) => b.awarded_at.localeCompare(a.awarded_at)).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{a.rule?.icon ?? '⭐'}</span>
                      <div>
                        <p className="text-white text-sm font-medium">{a.rule?.name ?? a.note ?? 'One-off award'}</p>
                        <p className="text-white/30 text-xs">{formatDate(a.awarded_at)}{a.rule?.name && a.note ? ` · ${a.note}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-teal-400 font-bold text-sm">+{a.points}</span>
                      <button onClick={() => deleteAward(a.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
