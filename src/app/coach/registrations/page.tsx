'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { CheckCircle2, XCircle, Trash2, Phone, Mail, MapPin, ExternalLink } from 'lucide-react'
import { useConfigList } from '@/hooks/useConfigList'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { logAudit } from '@/lib/audit'
import { formatDate } from '@/lib/utils'

const FALLBACK_CATEGORIES = ['U9', 'U13', 'First Team']
const FALLBACK_POSITIONS = ['GK', 'DEF', 'MID', 'FWD']

type Application = {
  id: string; guardian_name: string; relationship: string
  phone_primary: string; phone_secondary?: string; email?: string
  address_line1?: string; address_line2?: string; submitted_at: string
}
type ChildRow = {
  id: string; application_id: string; full_name: string; date_of_birth: string
  school_grade?: string; medical_conditions?: string; takes_medication?: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by?: string; reviewed_at?: string; review_note?: string; resolved_player_id?: string
}
type ReviewDraft = {
  full_name: string; date_of_birth: string; school_grade: string
  medical_conditions: string; takes_medication: string
  category: string; position: string; is_trial: boolean
}

export default function RegistrationsPage() {
  const supabase = createClient()
  const permitted = usePermissionGuard('registrations')
  const categories = useConfigList('categories', FALLBACK_CATEGORIES)
  const positions = useConfigList('positions', FALLBACK_POSITIONS)

  const [apps, setApps] = useState<Record<string, Application>>({})
  const [children, setChildren] = useState<ChildRow[]>([])
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ReviewDraft | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { if (permitted) fetchData() }, [permitted])

  async function fetchData() {
    const [{ data: appsData }, { data: kidsData }] = await Promise.all([
      supabase.from('player_applications').select('*'),
      supabase.from('player_application_children').select('*').order('created_at', { ascending: false }),
    ])
    const map: Record<string, Application> = {}
    ;(appsData ?? []).forEach(a => { map[a.id] = a })
    setApps(map)
    setChildren(kidsData ?? [])
    setLoaded(true)
  }

  function startReview(child: ChildRow) {
    setExpandedId(child.id)
    setRejectingId(null)
    setDraft({
      full_name: child.full_name,
      date_of_birth: child.date_of_birth,
      school_grade: child.school_grade ?? '',
      medical_conditions: child.medical_conditions ?? '',
      takes_medication: child.takes_medication ?? '',
      category: categories[0] ?? '',
      position: 'FWD',
      is_trial: false,
    })
  }

  function cancelReview() {
    setExpandedId(null)
    setDraft(null)
    setRejectingId(null)
    setRejectNote('')
  }

  async function approve(child: ChildRow) {
    if (!draft) return
    if (!draft.full_name || !draft.date_of_birth) { toast.error('Name and date of birth are required'); return }
    if (!draft.category || !draft.position) { toast.error('Pick a category and position before approving'); return }
    setSaving(true)

    const application = apps[child.application_id]
    const medParts: string[] = []
    if (draft.medical_conditions && !/^no$/i.test(draft.medical_conditions.trim())) medParts.push(`Allergies/conditions: ${draft.medical_conditions}`)
    if (draft.takes_medication && !/^no$/i.test(draft.takes_medication.trim())) medParts.push(`Medication: ${draft.takes_medication}`)

    const { data: newPlayer, error: pe } = await supabase.from('players').insert({
      full_name: draft.full_name,
      date_of_birth: draft.date_of_birth,
      category: draft.category,
      position: draft.position,
      nationality: 'Mauritian',
      school: draft.school_grade || null,
      address: [application?.address_line1, application?.address_line2].filter(Boolean).join(', ') || null,
      medical_notes: medParts.join('\n') || null,
      enrollment_status: draft.is_trial ? 'trial' : 'active',
    }).select().single()
    if (pe || !newPlayer) { toast.error('Failed to create player'); setSaving(false); return }

    const { error: ge } = await supabase.from('guardians').insert({
      full_name: application?.guardian_name ?? 'Unknown',
      relationship: application?.relationship ?? 'Parent',
      phone_primary: application?.phone_primary ?? '',
      phone_secondary: application?.phone_secondary || null,
      email: application?.email || null,
      player_id: newPlayer.id,
    })
    if (ge) toast.error('Player created, but guardian info failed to save — add it manually from the player page')

    if (!draft.is_trial) {
      const { data: fees } = await supabase.from('club_settings').select('value').eq('key', 'fees').single()
      const entryFee = (fees?.value as any)?.entry
      if (entryFee) {
        await supabase.from('payments').insert({ player_id: newPlayer.id, type: 'entry', amount: entryFee, status: 'pending' })
      }
    }

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('player_application_children').update({
      status: 'approved', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(), resolved_player_id: newPlayer.id,
    }).eq('id', child.id)

    logAudit(supabase, {
      action: 'create', entity: 'player', entity_id: newPlayer.id,
      summary: `Approved registration application → registered "${draft.full_name}" (${draft.category})`,
    })
    toast.success(`${draft.full_name} approved and registered!`)
    cancelReview()
    fetchData()
    setSaving(false)
  }

  async function reject(child: ChildRow) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('player_application_children').update({
      status: 'rejected', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(), review_note: rejectNote || null,
    }).eq('id', child.id)
    logAudit(supabase, {
      action: 'update', entity: 'player_application', entity_id: child.id,
      summary: `Rejected registration: "${child.full_name}"${rejectNote ? ' — ' + rejectNote : ''}`,
    })
    toast.success('Registration rejected')
    cancelReview()
    fetchData()
    setSaving(false)
  }

  async function deleteChild(child: ChildRow) {
    if (!confirm(`Permanently delete "${child.full_name}"'s registration? This can't be undone.`)) return
    await supabase.from('player_application_children').delete().eq('id', child.id)
    toast.success('Deleted')
    fetchData()
  }

  if (!permitted || !loaded) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  const filtered = children.filter(c => c.status === tab)
  const grouped: { application: Application; kids: ChildRow[] }[] = []
  filtered.forEach(c => {
    const application = apps[c.application_id]
    if (!application) return
    let group = grouped.find(g => g.application.id === application.id)
    if (!group) { group = { application, kids: [] }; grouped.push(group) }
    group.kids.push(c)
  })

  const pendingCount = children.filter(c => c.status === 'pending').length

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="page-title mb-1">Registrations</h1>
      <p className="text-white/30 text-sm mb-6">
        Applications submitted via the public registration form at <span className="text-teal-400">/apply</span>
      </p>

      <div className="flex gap-2 mb-6">
        {(['pending', 'approved', 'rejected'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-center border transition-all capitalize
              ${tab === t ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
            {t}{t === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {grouped.length === 0 && (
        <div className="card p-8 text-center text-white/30">
          No {tab} registrations.
        </div>
      )}

      <div className="space-y-5">
        {grouped.map(({ application, kids }) => (
          <div key={application.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4 pb-4 border-b border-white/5">
              <div>
                <p className="text-white font-bold text-sm">{application.guardian_name} <span className="text-white/30 font-normal">· {application.relationship}</span></p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/40">
                  <span className="flex items-center gap-1"><Phone size={12}/> {application.phone_primary}{application.phone_secondary ? ` / ${application.phone_secondary}` : ''}</span>
                  {application.email && <span className="flex items-center gap-1"><Mail size={12}/> {application.email}</span>}
                  {application.address_line1 && <span className="flex items-center gap-1"><MapPin size={12}/> {[application.address_line1, application.address_line2].filter(Boolean).join(', ')}</span>}
                </div>
              </div>
              <span className="text-white/20 text-xs flex-shrink-0">{formatDate(application.submitted_at)}</span>
            </div>

            <div className="space-y-3">
              {kids.map(child => (
                <div key={child.id} className="rounded-xl border border-white/10 overflow-hidden">
                  <div className="p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{child.full_name}</p>
                      <p className="text-white/30 text-xs">
                        DOB {formatDate(child.date_of_birth)}
                        {child.school_grade ? ` · ${child.school_grade}` : ''}
                      </p>
                      {tab === 'rejected' && child.review_note && (
                        <p className="text-red-300/70 text-xs mt-1">Reason: {child.review_note}</p>
                      )}
                      {tab === 'approved' && child.resolved_player_id && (
                        <Link href={`/coach/players/${child.resolved_player_id}`}
                          className="inline-flex items-center gap-1 text-teal-400 text-xs mt-1 hover:underline">
                          View player <ExternalLink size={11}/>
                        </Link>
                      )}
                    </div>
                    {tab === 'pending' && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => deleteChild(child)} title="Delete"
                          className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all">
                          <Trash2 size={15}/>
                        </button>
                        <button onClick={() => expandedId === child.id ? cancelReview() : startReview(child)}
                          className="btn-secondary py-1.5 px-3 text-xs">
                          {expandedId === child.id ? 'Close' : 'Review'}
                        </button>
                      </div>
                    )}
                  </div>

                  {expandedId === child.id && draft && (
                    <div className="p-4 pt-0 space-y-3 bg-white/[0.02] border-t border-white/5">
                      {(child.medical_conditions && !/^no$/i.test(child.medical_conditions.trim())) ||
                       (child.takes_medication && !/^no$/i.test(child.takes_medication.trim())) ? (
                        <div className="p-2.5 bg-amber-400/10 border border-amber-400/20 rounded-lg mt-3">
                          <p className="text-amber-300 text-xs font-bold">⚠ Medical / Medication</p>
                          {child.medical_conditions && <p className="text-white/70 text-xs mt-1">Conditions: {child.medical_conditions}</p>}
                          {child.takes_medication && <p className="text-white/70 text-xs mt-1">Medication: {child.takes_medication}</p>}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-2 gap-3 pt-3">
                        <div>
                          <label className="label mb-1 block">Full Name</label>
                          <input className="input py-2 text-sm" value={draft.full_name} onChange={e => setDraft(d => d && { ...d, full_name: e.target.value })}/>
                        </div>
                        <div>
                          <label className="label mb-1 block">Date of Birth</label>
                          <input type="date" className="input py-2 text-sm" value={draft.date_of_birth} onChange={e => setDraft(d => d && { ...d, date_of_birth: e.target.value })}/>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label mb-1 block">Category *</label>
                          <select className="input py-2 text-sm" value={draft.category} onChange={e => setDraft(d => d && { ...d, category: e.target.value })}>
                            <option value="">Select…</option>
                            {categories.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="label mb-1 block">Position *</label>
                          <select className="input py-2 text-sm" value={draft.position} onChange={e => setDraft(d => d && { ...d, position: e.target.value })}>
                            {positions.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                      <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-white/10 cursor-pointer hover:border-white/20">
                        <input type="checkbox" className="w-4 h-4 mt-0.5 accent-amber-400" checked={draft.is_trial} onChange={e => setDraft(d => d && { ...d, is_trial: e.target.checked })}/>
                        <span>
                          <span className="text-white text-xs font-medium block">Register as a trial</span>
                          <span className="text-white/40 text-xs">No entry fee charged yet — convert from the player's page later.</span>
                        </span>
                      </label>

                      {rejectingId === child.id ? (
                        <div className="space-y-2 pt-1">
                          <input className="input py-2 text-sm" placeholder="Reason (optional) — e.g. duplicate, incomplete info"
                            value={rejectNote} onChange={e => setRejectNote(e.target.value)}/>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setRejectingId(null)} className="btn-secondary flex-1 py-2 text-xs">Cancel</button>
                            <button type="button" onClick={() => reject(child)} disabled={saving} className="btn-danger flex-1 py-2 text-xs">
                              {saving ? 'Rejecting…' : 'Confirm Rejection'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={() => { setRejectingId(child.id); setRejectNote('') }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
                            <XCircle size={14}/> Reject
                          </button>
                          <button type="button" onClick={() => approve(child)} disabled={saving}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-teal-400 text-[#0D1B2A] hover:bg-teal-300 transition-all disabled:opacity-50">
                            <CheckCircle2 size={14}/> {saving ? 'Approving…' : 'Approve & Register'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
