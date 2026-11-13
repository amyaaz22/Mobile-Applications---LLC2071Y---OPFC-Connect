'use client'
import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import {
  Plus, Trash2, Download, Upload, Mail, Search, X,
  ShieldCheck, Users2, UserMinus, UserPlus, Contact,
  ClipboardList, CheckCircle2, XCircle, Phone as PhoneIcon, Pencil,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import * as XLSX from 'xlsx'
import { PERMISSION_AREAS, hasPermission } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'
import { useConfigList } from '@/hooks/useConfigList'

const COACH_PERMISSION_AREAS = PERMISSION_AREAS.filter(a => a.key !== 'staff' && a.key !== 'system')
const FALLBACK_RELATIONSHIPS = ['Parent', 'Father', 'Mother', 'Uncle', 'Aunt', 'Sibling', 'Other']

function InviteModal({ role, onClose, onSent }: { role: 'coach' | 'parent'; onClose: () => void; onSent: () => void }) {
  const supabase = createClient()
  const [form, setForm] = useState({ email: '', full_name: '' })
  const [sending, setSending] = useState(false)

  async function send() {
    if (!form.email.trim() || !form.full_name.trim()) { toast.error('Name and email are required'); return }
    setSending(true)
    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email.trim(), full_name: form.full_name.trim(), role }),
    })
    const data = await res.json()
    setSending(false)
    if (!res.ok) { toast.error(data.error ?? 'Invite failed'); return }
    logAudit(supabase, { action: 'invite', entity: 'staff', summary: `Invited ${form.full_name.trim()} (${form.email.trim()}) as ${role}` })
    if (data.warning) { toast.error(data.warning, { duration: 8000 }) } else { toast.success(`Invite sent to ${form.email}`) }
    onSent()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="card w-full sm:max-w-sm rounded-b-none sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Invite {role === 'coach' ? 'Coach' : 'Parent'}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={18}/></button>
        </div>
        <div>
          <label className="label mb-1.5 block">Full Name *</label>
          <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}/>
        </div>
        <div>
          <label className="label mb-1.5 block">Email *</label>
          <input type="email" className="input" placeholder="their@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
        </div>
        <p className="text-white/30 text-xs">They'll get an email to set a password. Their account is created as a {role} right away — no manual promotion needed.</p>
        <div className="flex gap-3">
          <button onClick={send} disabled={sending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Mail size={14}/>{sending ? 'Sending…' : 'Send Invite'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function GuardianEditModal({
  guardian, relationships, onClose, onSave,
}: {
  guardian: any; relationships: string[]; onClose: () => void; onSave: (patch: { full_name: string; relationship: string; phone_primary: string; phone_secondary: string; email: string }) => Promise<boolean>
}) {
  const [form, setForm] = useState({
    full_name: guardian.full_name ?? '', relationship: guardian.relationship ?? 'Parent',
    phone_primary: guardian.phone_primary ?? '', phone_secondary: guardian.phone_secondary ?? '',
    email: guardian.email ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.full_name.trim() || !form.phone_primary.trim()) { toast.error('Name and primary phone are required'); return }
    setSaving(true)
    const ok = await onSave(form)
    setSaving(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="card w-full sm:max-w-sm rounded-b-none sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Edit Guardian</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={18}/></button>
        </div>
        <p className="text-white/30 text-xs -mt-2">For {guardian.player?.full_name ?? 'player'}{guardian.player?.player_code ? ` (${guardian.player.player_code})` : ''}</p>
        <div>
          <label className="label mb-1.5 block">Full Name *</label>
          <input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}/>
        </div>
        <div>
          <label className="label mb-1.5 block">Relationship</label>
          <select className="input" value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}>
            {relationships.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label mb-1.5 block">Primary Phone *</label>
            <input className="input" value={form.phone_primary} onChange={e => setForm(f => ({ ...f, phone_primary: e.target.value }))}/>
          </div>
          <div>
            <label className="label mb-1.5 block">Secondary Phone</label>
            <input className="input" value={form.phone_secondary} onChange={e => setForm(f => ({ ...f, phone_secondary: e.target.value }))}/>
          </div>
        </div>
        <div>
          <label className="label mb-1.5 block">Email</label>
          <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/>
        </div>
        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

// Invites a specific guardian as a parent account and links it to this
// guardian row directly (sets guardians.profile_id to the new account's
// id) — a more direct path than the existing "self-register at /register,
// then a coach saves the player edit page to auto-link by matching email"
// flow documented in "How Parent Linking Works", useful when staff want to
// proactively grant access rather than waiting on the parent to register
// first.
function GuardianInviteModal({ guardian, onClose, onSend }: { guardian: any; onClose: () => void; onSend: (email: string) => Promise<boolean> }) {
  const [email, setEmail] = useState(guardian.email ?? '')
  const [sending, setSending] = useState(false)

  async function send() {
    if (!email.trim()) { toast.error('Email is required to send an invite'); return }
    setSending(true)
    const ok = await onSend(email.trim())
    setSending(false)
    if (ok) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="card w-full sm:max-w-sm rounded-b-none sm:rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Grant Access</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white p-1"><X size={18}/></button>
        </div>
        <p className="text-white/40 text-sm">
          Invite <span className="text-white font-semibold">{guardian.full_name}</span> to create a parent account linked to <span className="text-white font-semibold">{guardian.player?.full_name ?? 'this player'}</span>.
        </p>
        <div>
          <label className="label mb-1.5 block">Email *</label>
          <input type="email" className="input" placeholder="their@email.com" value={email} onChange={e => setEmail(e.target.value)}/>
          {!guardian.email && <p className="text-white/25 text-xs mt-1">No email on file yet — this will also be saved to their guardian record.</p>}
        </div>
        <p className="text-white/30 text-xs">They'll get an email to set a password. Their account is created as a parent and linked to this child right away — no separate "auto-link" step needed.</p>
        <div className="flex gap-3">
          <button onClick={send} disabled={sending} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <Mail size={14}/>{sending ? 'Sending…' : 'Send Invite'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function StaffPage() {
  const supabase = createClient()
  const router = useRouter()
  const coachFileRef = useRef<HTMLInputElement>(null)
  const parentFileRef = useRef<HTMLInputElement>(null)

  const [checked, setChecked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [viewerId, setViewerId] = useState('')
  const [viewerIsFullAdmin, setViewerIsFullAdmin] = useState(false)
  const [tab, setTab] = useState<'coaches' | 'parents' | 'applications'>('coaches')
  const [loading, setLoading] = useState(true)

  const [coaches, setCoaches] = useState<any[]>([])
  const [guardians, setGuardians] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [inviteRole, setInviteRole] = useState<'coach' | 'parent' | null>(null)

  const [coachApps, setCoachApps] = useState<any[]>([])
  const [appsTab, setAppsTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null)
  const [rejectAppNote, setRejectAppNote] = useState('')

  const [promoteSearch, setPromoteSearch] = useState('')
  const [promoteResults, setPromoteResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const [guardianSearch, setGuardianSearch] = useState('')
  const [selectedGuardians, setSelectedGuardians] = useState<Set<string>>(new Set())
  const [editingGuardian, setEditingGuardian] = useState<any | null>(null)
  const [invitingGuardian, setInvitingGuardian] = useState<any | null>(null)
  const [bulkInviting, setBulkInviting] = useState(false)
  const relationships = useConfigList('guardian_relationships', FALLBACK_RELATIONSHIPS)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!hasPermission(data, 'staff')) { router.replace('/unauthorized'); return }
      setViewerId(user.id)
      setViewerIsFullAdmin(data?.role === 'admin' && !(data?.permissions?.length))
      setIsAdmin(true)
      setChecked(true)
      loadAll()
    }
    check()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: c }, { data: g }, { data: cats }, { data: apps }] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['admin', 'coach']).order('full_name'),
      supabase.from('guardians').select('*, player:players(full_name, player_code)').order('full_name'),
      supabase.from('club_settings').select('value').eq('key', 'categories').single(),
      supabase.from('coach_applications').select('*').order('submitted_at', { ascending: false }),
    ])
    setCoaches(c ?? [])
    setGuardians(g ?? [])
    setCategories((cats?.value as string[]) ?? [])
    setCoachApps(apps ?? [])
    setLoading(false)
  }

  // Approving doesn't create the account itself — it drives the same
  // /api/staff/invite route "Invite Coach" already uses, so there's one
  // place (not two) that actually creates a coach auth user + sets its
  // role. The application row just records the decision + links the
  // resulting profile once the invite succeeds.
  async function approveApplication(app: any) {
    setApprovingId(app.id)
    const res = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: app.email, full_name: app.full_name, role: 'coach' }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error(data.error ?? 'Invite failed')
      setApprovingId(null)
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('coach_applications').update({
      status: 'approved', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(),
      resolved_profile_id: data.newId ?? null,
    }).eq('id', app.id)
    logAudit(supabase, {
      action: 'invite', entity: 'staff', entity_id: data.newId,
      summary: `Approved coach application → invited ${app.full_name} (${app.email})`,
    })
    if (data.warning) toast.error(data.warning, { duration: 8000 })
    else toast.success(`${app.full_name} approved and invited!`)
    setApprovingId(null)
    loadAll()
  }

  async function rejectApplication(app: any) {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('coach_applications').update({
      status: 'rejected', reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString(),
      review_note: rejectAppNote || null,
    }).eq('id', app.id)
    logAudit(supabase, {
      action: 'update', entity: 'staff', entity_id: app.id,
      summary: `Rejected coach application: ${app.full_name}${rejectAppNote ? ' — ' + rejectAppNote : ''}`,
    })
    toast.success('Application rejected')
    setRejectingAppId(null)
    setRejectAppNote('')
    loadAll()
  }

  async function deleteApplication(app: any) {
    if (!confirm(`Permanently delete ${app.full_name}'s application? This can't be undone.`)) return
    await supabase.from('coach_applications').delete().eq('id', app.id)
    toast.success('Deleted')
    loadAll()
  }

  async function searchPromotable() {
    if (!promoteSearch.trim()) { setPromoteResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['parent', 'player'])
      .or(`full_name.ilike.%${promoteSearch}%,email.ilike.%${promoteSearch}%`)
      .limit(8)
    setPromoteResults(data ?? [])
    setSearching(false)
  }

  async function promote(id: string, role: 'coach' | 'admin' = 'coach') {
    const person = promoteResults.find(p => p.id === id) ?? coaches.find(c => c.id === id)
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) { toast.error('Failed to promote: ' + error.message); return }
    logAudit(supabase, { action: 'promote', entity: 'staff', entity_id: id, summary: `Promoted ${person?.full_name ?? id} to ${role}` })
    toast.success(role === 'admin' ? 'Promoted to admin' : 'Promoted to coach')
    setPromoteResults(r => r.filter(p => p.id !== id))
    loadAll()
  }

  async function demote(id: string, name: string) {
    if (!confirm(`Remove coach access for ${name}? They'll become a regular parent account.`)) return
    const { error } = await supabase.from('profiles').update({ role: 'parent', assigned_categories: null }).eq('id', id)
    if (error) { toast.error('Failed: ' + error.message); return }
    logAudit(supabase, { action: 'demote', entity: 'staff', entity_id: id, summary: `Removed coach access for ${name}` })
    toast.success('Coach access removed')
    loadAll()
  }

  async function demoteAdmin(id: string, name: string) {
    if (id === viewerId) { toast.error('You can\'t remove your own admin access — ask another unrestricted admin'); return }
    if (!confirm(`Remove admin access for ${name}? They'll become a coach instead.`)) return
    const { error } = await supabase.from('profiles').update({ role: 'coach', permissions: null }).eq('id', id)
    if (error) { toast.error('Failed: ' + error.message); return }
    logAudit(supabase, { action: 'demote', entity: 'staff', entity_id: id, summary: `Removed admin access for ${name}` })
    toast.success('Admin access removed')
    loadAll()
  }

  async function toggleCategory(profileId: string, current: string[] | null, cat: string) {
    const list = current ?? []
    const next = list.includes(cat) ? list.filter(c => c !== cat) : [...list, cat]
    const { error } = await supabase.from('profiles').update({ assigned_categories: next.length ? next : null }).eq('id', profileId)
    if (error) { toast.error('Failed to update'); return }
    loadAll()
  }

  async function togglePermission(profileId: string, current: string[] | null, area: string) {
    if (profileId === viewerId) { toast.error('You can\'t narrow your own access — ask another unrestricted admin'); return }
    const person = coaches.find(c => c.id === profileId)
    const list = current ?? []
    const next = list.includes(area) ? list.filter(a => a !== area) : [...list, area]
    const { error } = await supabase.from('profiles').update({ permissions: next.length ? next : null }).eq('id', profileId)
    if (error) { toast.error('Failed to update — only an unrestricted admin can change this'); return }
    logAudit(supabase, { action: 'update', entity: 'staff', entity_id: profileId, summary: `Changed ${person?.full_name ?? profileId}'s access: ${next.length ? next.join(', ') : 'unrestricted'}` })
    loadAll()
  }

  async function deleteGuardian(id: string) {
    if (!confirm('Remove this guardian record? This does not delete their login account.')) return
    await supabase.from('guardians').delete().eq('id', id)
    toast.success('Removed')
    loadAll()
  }

  function toggleSelectGuardian(id: string) {
    setSelectedGuardians(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllGuardians() {
    const ids = filteredGuardians.map(g => g.id)
    const allSelected = ids.length > 0 && ids.every(id => selectedGuardians.has(id))
    setSelectedGuardians(prev => {
      const next = new Set(prev)
      ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  async function saveGuardianEdit(id: string, patch: { full_name: string; relationship: string; phone_primary: string; phone_secondary: string; email: string }) {
    const { error } = await supabase.from('guardians').update({
      full_name: patch.full_name, relationship: patch.relationship,
      phone_primary: patch.phone_primary, phone_secondary: patch.phone_secondary || null,
      email: patch.email || null,
    }).eq('id', id)
    if (error) { toast.error('Failed to save: ' + error.message); return false }
    logAudit(supabase, { action: 'update', entity: 'staff', entity_id: id, summary: `Updated guardian contact: ${patch.full_name}` })
    toast.success('Guardian updated')
    loadAll()
    return true
  }

  // Invites the guardian directly and links the new account to this exact
  // guardian row (profile_id) — see GuardianInviteModal's comment above for
  // why this is a more direct path than the self-register + auto-link flow.
  async function sendGuardianInvite(g: any, email: string) {
    if (email !== (g.email ?? '')) {
      await supabase.from('guardians').update({ email }).eq('id', g.id)
    }
    const res = await fetch('/api/staff/invite', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: g.full_name, role: 'parent' }),
    })
    const data = await res.json()
    if (!res.ok) { toast.error(data.error ?? 'Invite failed'); return false }
    if (data.newId) await supabase.from('guardians').update({ profile_id: data.newId }).eq('id', g.id)
    logAudit(supabase, {
      action: 'invite', entity: 'staff', entity_id: data.newId,
      summary: `Invited ${g.full_name} (${email}) as parent, linked to ${g.player?.full_name ?? 'player'}`,
    })
    if (data.warning) toast.error(data.warning, { duration: 8000 })
    else toast.success(`Invite sent to ${email}`)
    loadAll()
    return true
  }

  // Unlinks the account from this one guardian row only — does not delete
  // the Supabase Auth account or touch its role, since the same person may
  // be linked to other children via other guardian rows. A real "delete
  // this parent's account entirely" is a much bigger, separate action not
  // exposed here.
  async function revokeGuardianAccess(g: any) {
    if (!confirm(`Revoke ${g.full_name}'s access to ${g.player?.full_name ?? 'this player'}'s data? This unlinks their account from this record only — it does not delete their login, and they may still see other children linked to the same account.`)) return
    const { error } = await supabase.from('guardians').update({ profile_id: null }).eq('id', g.id)
    if (error) { toast.error('Failed: ' + error.message); return }
    logAudit(supabase, { action: 'update', entity: 'staff', entity_id: g.id, summary: `Revoked account access for ${g.full_name} (${g.player?.full_name ?? 'player'})` })
    toast.success('Access revoked')
    loadAll()
  }

  async function bulkInviteGuardians() {
    const selected = guardians.filter(g => selectedGuardians.has(g.id))
    const targets = selected.filter(g => !g.profile_id)
    const withEmail = targets.filter(g => g.email)
    const skippedNoEmail = targets.length - withEmail.length
    const skippedLinked = selected.length - targets.length
    if (!withEmail.length) { toast.error('None of the selected parents both lack an account and have an email on file'); return }

    setBulkInviting(true)
    let sent = 0, failed = 0
    for (const g of withEmail) {
      const res = await fetch('/api/staff/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: g.email, full_name: g.full_name, role: 'parent' }),
      })
      const data = await res.json()
      if (res.ok) {
        sent++
        if (data.newId) await supabase.from('guardians').update({ profile_id: data.newId }).eq('id', g.id)
      } else failed++
      await new Promise(r => setTimeout(r, 150))
    }
    setBulkInviting(false)
    if (sent > 0) logAudit(supabase, { action: 'invite', entity: 'staff', summary: `Bulk-invited ${sent} parent(s) from Staff & Parents selection` })
    const skipped = [skippedLinked && `${skippedLinked} already linked`, skippedNoEmail && `${skippedNoEmail} no email on file`].filter(Boolean).join(', ')
    toast.success(`${sent} invited${failed ? `, ${failed} failed` : ''}${skipped ? ` (skipped: ${skipped})` : ''}`)
    setSelectedGuardians(new Set())
    loadAll()
  }

  function exportSelectedGuardians() {
    const rows = guardians.filter(g => selectedGuardians.has(g.id)).map(g => ({
      'Guardian Name': g.full_name, 'Relationship': g.relationship,
      'Phone (Primary)': g.phone_primary, 'Phone (Secondary)': g.phone_secondary ?? '',
      'Email': g.email ?? '', 'Player Code': g.player?.player_code ?? '',
      'Player Name': g.player?.full_name ?? '', 'Account Linked': g.profile_id ? 'Yes' : 'No',
    }))
    if (!rows.length) return
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Parents')
    XLSX.writeFile(wb, `OPFC_Parents_Selected_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${rows.length} selected parent(s) exported`)
  }

  function exportCoaches() {
    const rows = coaches.map(c => ({
      'Full Name': c.full_name, 'Email': c.email, 'Role': c.role,
      'Assigned Categories': (c.assigned_categories ?? []).join(', ') || 'All',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 24 }, { wch: 26 }, { wch: 10 }, { wch: 24 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Coaches')
    XLSX.writeFile(wb, `OPFC_Coaches_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${rows.length} coaches exported`)
  }

  function importCoaches(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws) as any[]
      const rows = json.filter(r => r['Email'] && r['Full Name'])
      if (!rows.length) { toast.error('No valid rows — need Full Name and Email columns'); return }
      let sent = 0, failed = 0
      for (const r of rows) {
        const res = await fetch('/api/staff/invite', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: r['Email'], full_name: r['Full Name'], role: 'coach' }),
        })
        if (res.ok) sent++; else failed++
        await new Promise(r => setTimeout(r, 150))
      }
      if (sent > 0) logAudit(supabase, { action: 'invite', entity: 'staff', summary: `Bulk-invited ${sent} coach(es) from import${failed ? ` (${failed} failed)` : ''}` })
      toast.success(`${sent} invited${failed ? `, ${failed} failed (likely already registered)` : ''}`)
      if (coachFileRef.current) coachFileRef.current.value = ''
      loadAll()
    }
    reader.readAsBinaryString(file)
  }

  function normalizePhone(phone: string) {
    const trimmed = phone.trim().replace(/[\s-]/g, '')
    if (!trimmed) return ''
    if (trimmed.startsWith('+')) return trimmed
    if (/^\d{8}$/.test(trimmed)) return `+230${trimmed}` // Mauritius mobile numbers are 8 digits
    return trimmed
  }

  function vcardEscape(s: string) {
    return s.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n')
  }

  function exportContactsVCard() {
    if (!guardians.length) { toast.error('No parent contacts to export'); return }
    const cards = guardians
      .filter(g => g.phone_primary)
      .map(g => {
        const playerName = g.player?.full_name ?? 'Unknown Player'
        const displayName = `OPFC - ${g.full_name} (${g.relationship} of ${playerName})`
        const lines = [
          'BEGIN:VCARD',
          'VERSION:3.0',
          `FN:${vcardEscape(displayName)}`,
          `N:${vcardEscape(g.full_name)};;;;`,
          `ORG:${vcardEscape('Oasis Pailles Football Club')}`,
          `TEL;TYPE=CELL:${normalizePhone(g.phone_primary)}`,
        ]
        if (g.phone_secondary) lines.push(`TEL;TYPE=HOME:${normalizePhone(g.phone_secondary)}`)
        if (g.email) lines.push(`EMAIL:${vcardEscape(g.email)}`)
        lines.push(`NOTE:${vcardEscape(`Guardian (${g.relationship}) of ${playerName}${g.player?.player_code ? ` — ${g.player.player_code}` : ''}`)}`)
        lines.push('END:VCARD')
        return lines.join('\r\n')
      })
    const blob = new Blob([cards.join('\r\n')], { type: 'text/vcard;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `OPFC_Parent_Contacts_${new Date().toISOString().split('T')[0]}.vcf`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${cards.length} contacts exported — import the .vcf file into your phone's Contacts app`)
  }

  function exportGuardians() {
    const rows = guardians.map(g => ({
      'Guardian Name': g.full_name, 'Relationship': g.relationship,
      'Phone (Primary)': g.phone_primary, 'Phone (Secondary)': g.phone_secondary ?? '',
      'Email': g.email ?? '', 'Player Code': g.player?.player_code ?? '',
      'Player Name': g.player?.full_name ?? '', 'Account Linked': g.profile_id ? 'Yes' : 'No',
    }))
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Parents')
    XLSX.writeFile(wb, `OPFC_Parents_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${rows.length} parents exported`)
  }

  function importGuardians(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'binary' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws) as any[]
      let updated = 0, notFound = 0
      for (const r of json) {
        const code = r['Player Code']
        if (!code) continue
        const { data: player } = await supabase.from('players').select('id').eq('player_code', code).single()
        if (!player) { notFound++; continue }
        const payload = {
          full_name: r['Guardian Name'],
          relationship: r['Relationship'] || 'Parent',
          phone_primary: r['Phone (Primary)'],
          phone_secondary: r['Phone (Secondary)'] || null,
          email: r['Email'] || null,
        }
        const { data: existing } = await supabase.from('guardians').select('id').eq('player_id', player.id).limit(1).maybeSingle()
        if (existing) {
          await supabase.from('guardians').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('guardians').insert({ ...payload, player_id: player.id })
        }
        updated++
      }
      toast.success(`${updated} guardians updated${notFound ? `, ${notFound} player codes not found` : ''}`)
      if (parentFileRef.current) parentFileRef.current.value = ''
      loadAll()
    }
    reader.readAsBinaryString(file)
  }

  const filteredGuardians = useMemo(() => {
    if (!guardianSearch.trim()) return guardians
    const q = guardianSearch.toLowerCase()
    return guardians.filter(g =>
      g.full_name?.toLowerCase().includes(q) ||
      g.email?.toLowerCase().includes(q) ||
      g.player?.full_name?.toLowerCase().includes(q) ||
      g.player?.player_code?.toLowerCase().includes(q)
    )
  }, [guardians, guardianSearch])

  if (!checked) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )
  if (!isAdmin) return null

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title flex items-center gap-2"><ShieldCheck size={26} className="text-teal-400"/> Staff &amp; Parents</h1>
        <p className="text-white/30 text-sm mt-1">Admin-only — manage who has coach access and keep parent contacts up to date</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('coaches')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2
            ${tab === 'coaches' ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
          <Users2 size={14}/> Coaches ({coaches.length})
        </button>
        <button onClick={() => setTab('parents')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2
            ${tab === 'parents' ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
          <UserPlus size={14}/> Parents ({guardians.length})
        </button>
        <button onClick={() => setTab('applications')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2
            ${tab === 'applications' ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
          <ClipboardList size={14}/> Applications {coachApps.filter(a => a.status === 'pending').length > 0 ? `(${coachApps.filter(a => a.status === 'pending').length})` : ''}
        </button>
      </div>

      {tab === 'coaches' ? (
        <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => coachFileRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
                <Upload size={14}/> Import
              </button>
              <input ref={coachFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importCoaches}/>
              <button onClick={exportCoaches} className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={14}/> Export
              </button>
            </div>
            <button onClick={() => setInviteRole('coach')} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={14}/> Invite Coach
            </button>
          </div>

          {/* Promote existing */}
          <div className="card p-4 mb-5">
            <label className="label mb-1.5 block">Promote an existing account</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                <input className="input pl-8 text-sm" placeholder="Search by name or email…" value={promoteSearch}
                  onChange={e => setPromoteSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchPromotable()}/>
              </div>
              <button onClick={searchPromotable} className="btn-secondary text-sm">{searching ? '…' : 'Search'}</button>
            </div>
            {promoteResults.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {promoteResults.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white/3">
                    <div>
                      <p className="text-white text-sm font-medium">{p.full_name}</p>
                      <p className="text-white/30 text-xs">{p.email} · currently {p.role}</p>
                    </div>
                    {viewerIsFullAdmin && (
                      <div className="flex items-center gap-3">
                        <button onClick={() => promote(p.id, 'coach')} className="text-teal-400 hover:text-teal-300 text-xs font-semibold">Make Coach</button>
                        <button onClick={() => promote(p.id, 'admin')} className="text-purple-300 hover:text-purple-200 text-xs font-semibold">Make Admin</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/30 gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
            </div>
          ) : (
            <div className="space-y-2">
              {coaches.map(c => (
                <div key={c.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-teal-400 font-bold text-sm">{c.full_name?.[0]?.toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">{c.full_name}</p>
                        <p className="text-white/30 text-xs">{c.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`badge text-xs ${c.role === 'admin' ? 'bg-purple-500/15 text-purple-300 border-purple-500/25' : 'bg-teal-500/15 text-teal-300 border-teal-500/25'}`}>
                        {c.role}
                      </span>
                      {c.role === 'coach' && viewerIsFullAdmin && (
                        <button onClick={() => promote(c.id, 'admin')} className="text-purple-300/60 hover:text-purple-300 text-xs font-semibold">Make Admin</button>
                      )}
                      {c.role !== 'admin' && viewerIsFullAdmin && (
                        <button onClick={() => demote(c.id, c.full_name)} className="text-white/20 hover:text-red-400 transition-colors p-1" title="Remove coach access">
                          <UserMinus size={15}/>
                        </button>
                      )}
                      {c.role === 'admin' && viewerIsFullAdmin && c.id !== viewerId && (
                        <button onClick={() => demoteAdmin(c.id, c.full_name)} className="text-white/20 hover:text-red-400 transition-colors p-1" title="Remove admin access">
                          <UserMinus size={15}/>
                        </button>
                      )}
                    </div>
                  </div>
                  {c.role === 'coach' && categories.length > 0 && (
                    <div className="pl-12 mb-3">
                      <p className="text-white/25 text-xs mb-1.5">Scoped to (UI filter, not a security boundary) — empty means unrestricted:</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {categories.map(cat => (
                          <button key={cat} onClick={() => toggleCategory(c.id, c.assigned_categories, cat)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all
                              ${(c.assigned_categories ?? []).includes(cat) ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/40 hover:text-white'}`}>
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.role === 'coach' && (
                    <div className="pl-12">
                      <p className="text-white/25 text-xs mb-1.5">
                        {(c.permissions?.length ?? 0) === 0 ? 'Full access to every area.' : 'Access limited to:'}
                        {!viewerIsFullAdmin && ' Only an unrestricted admin can change this.'}
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {COACH_PERMISSION_AREAS.map(({ key, label }) => (
                          <button key={key} disabled={!viewerIsFullAdmin}
                            onClick={() => togglePermission(c.id, c.permissions, key)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed
                              ${(c.permissions ?? []).includes(key) ? 'bg-purple-400/10 border-purple-400/30 text-purple-300' : 'border-white/10 text-white/40 hover:text-white'}`}
                            title={label}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {c.role === 'admin' && (
                    <div className="pl-12">
                      <p className="text-white/25 text-xs mb-1.5">
                        {(c.permissions?.length ?? 0) === 0
                          ? 'Unrestricted — full access to everything.'
                          : 'Restricted to:'}
                        {c.id === viewerId
                          ? ' You can\'t narrow your own access — ask another unrestricted admin.'
                          : !viewerIsFullAdmin && ' Only an unrestricted admin can change this.'}
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {PERMISSION_AREAS.map(({ key, label }) => (
                          <button key={key} disabled={!viewerIsFullAdmin || c.id === viewerId}
                            onClick={() => togglePermission(c.id, c.permissions, key)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 disabled:cursor-not-allowed
                              ${(c.permissions ?? []).includes(key) ? 'bg-purple-400/10 border-purple-400/30 text-purple-300' : 'border-white/10 text-white/40 hover:text-white'}`}
                            title={c.id === viewerId ? 'Can\'t change your own permissions' : label}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === 'parents' ? (
        <>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
              <input className="input pl-8 text-sm" placeholder="Search parents or player…" value={guardianSearch} onChange={e => setGuardianSearch(e.target.value)}/>
            </div>
            <div className="flex gap-2">
              <button onClick={() => parentFileRef.current?.click()} className="btn-secondary flex items-center gap-2 text-sm">
                <Upload size={14}/> Import
              </button>
              <input ref={parentFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={importGuardians}/>
              <button onClick={exportGuardians} className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={14}/> Export
              </button>
              <button onClick={exportContactsVCard} className="btn-secondary flex items-center gap-2 text-sm" title="Download a .vcf file to bulk-import into your phone's Contacts app">
                <Contact size={14}/> Export Contacts
              </button>
              <button onClick={() => setInviteRole('parent')} className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={14}/> Invite Parent
              </button>
            </div>
          </div>
          <p className="text-white/25 text-xs mb-4">Import matches rows to players by Player Code and updates that player's guardian contact — export first to get the right codes.</p>

          {selectedGuardians.size > 0 && (
            <div className="card p-3 mb-4 flex flex-wrap items-center gap-3 border border-teal-400/20 bg-teal-400/5">
              <span className="text-white text-sm font-semibold">{selectedGuardians.size} selected</span>
              <button onClick={() => setSelectedGuardians(new Set())} className="text-white/40 text-xs hover:text-white flex items-center gap-1">
                <X size={12}/> Clear
              </button>
              <div className="flex-1"/>
              <button onClick={exportSelectedGuardians} className="btn-secondary flex items-center gap-2 text-sm">
                <Download size={14}/> Export Selected
              </button>
              <button onClick={bulkInviteGuardians} disabled={bulkInviting} className="btn-primary flex items-center gap-2 text-sm">
                <Mail size={14}/> {bulkInviting ? 'Inviting…' : 'Send Invite to Selected'}
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/30 gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox"
                          checked={filteredGuardians.length > 0 && filteredGuardians.every(g => selectedGuardians.has(g.id))}
                          onChange={toggleSelectAllGuardians}
                          className="w-4 h-4 accent-teal-400 cursor-pointer"/>
                      </th>
                      {['Guardian', 'Phone', 'Player', 'Account', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGuardians.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-white/30">No parents found</td></tr>
                    ) : filteredGuardians.map((g, i) => (
                      <tr key={g.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'} ${selectedGuardians.has(g.id) ? 'bg-teal-400/5' : ''}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox"
                            checked={selectedGuardians.has(g.id)}
                            onChange={() => toggleSelectGuardian(g.id)}
                            className="w-4 h-4 accent-teal-400 cursor-pointer"/>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm font-medium">{g.full_name}</div>
                          <div className="text-white/30 text-xs">{g.relationship}{g.email ? ` · ${g.email}` : ''}</div>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-sm">{g.phone_primary}</td>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm">{g.player?.full_name ?? '—'}</div>
                          <div className="text-white/30 text-xs font-mono">{g.player?.player_code ?? ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`badge text-xs ${g.profile_id ? 'bg-green-500/15 text-green-300 border-green-500/25' : 'bg-white/5 text-white/40 border-white/10'}`}>
                              {g.profile_id ? 'Linked' : 'No account'}
                            </span>
                            {g.profile_id ? (
                              <button onClick={() => revokeGuardianAccess(g)} className="text-red-300/60 hover:text-red-300 text-xs font-semibold">Revoke</button>
                            ) : (
                              <button onClick={() => setInvitingGuardian(g)} className="text-teal-400/70 hover:text-teal-400 text-xs font-semibold">Grant Access</button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setEditingGuardian(g)} className="text-white/20 hover:text-teal-400 transition-colors p-1" title="Edit">
                              <Pencil size={14}/>
                            </button>
                            <button onClick={() => deleteGuardian(g.id)} className="text-white/20 hover:text-red-400 transition-colors p-1" title="Delete">
                              <Trash2 size={14}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-white/30 text-xs mb-4">
            Submitted via the public application form at <span className="text-teal-400">/apply/coach</span> — approving sends the same invite as "Invite Coach" above.
          </p>
          <div className="flex gap-2 mb-5">
            {(['pending', 'approved', 'rejected'] as const).map(t => (
              <button key={t} onClick={() => setAppsTab(t)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold text-center border transition-all capitalize
                  ${appsTab === t ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/40 hover:text-white/70'}`}>
                {t}{t === 'pending' && coachApps.filter(a => a.status === 'pending').length > 0 ? ` (${coachApps.filter(a => a.status === 'pending').length})` : ''}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-white/30 gap-3">
              <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
            </div>
          ) : (
            <div className="space-y-3">
              {coachApps.filter(a => a.status === appsTab).length === 0 && (
                <div className="card p-8 text-center text-white/30">No {appsTab} applications.</div>
              )}
              {coachApps.filter(a => a.status === appsTab).map(app => (
                <div key={app.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-semibold text-sm">{app.full_name}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/40">
                        <span className="flex items-center gap-1"><PhoneIcon size={12}/> {app.phone}</span>
                        <span className="flex items-center gap-1"><Mail size={12}/> {app.email}</span>
                        {app.address && <span>{app.address}</span>}
                      </div>
                      {app.categories_interested?.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap mt-2">
                          {app.categories_interested.map((c: string) => (
                            <span key={c} className="badge bg-white/5 text-white/50 border-white/10 text-[10px] py-0">{c}</span>
                          ))}
                        </div>
                      )}
                      {app.qualifications && <p className="text-white/50 text-xs mt-2"><span className="text-white/30">Qualifications:</span> {app.qualifications}</p>}
                      {app.experience && <p className="text-white/50 text-xs mt-1"><span className="text-white/30">Experience:</span> {app.experience}</p>}
                      {app.availability && <p className="text-white/50 text-xs mt-1"><span className="text-white/30">Availability:</span> {app.availability}</p>}
                      {app.motivation && <p className="text-white/50 text-xs mt-1"><span className="text-white/30">Motivation:</span> {app.motivation}</p>}
                      {appsTab === 'rejected' && app.review_note && <p className="text-red-300/70 text-xs mt-2">Reason: {app.review_note}</p>}
                    </div>
                    <span className="text-white/20 text-xs flex-shrink-0">{formatDate(app.submitted_at)}</span>
                  </div>

                  {appsTab === 'pending' && (
                    rejectingAppId === app.id ? (
                      <div className="space-y-2 pt-3 mt-3 border-t border-white/5">
                        <input className="input py-2 text-sm" placeholder="Reason (optional)"
                          value={rejectAppNote} onChange={e => setRejectAppNote(e.target.value)}/>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setRejectingAppId(null)} className="btn-secondary flex-1 py-2 text-xs">Cancel</button>
                          <button type="button" onClick={() => rejectApplication(app)} className="btn-danger flex-1 py-2 text-xs">Confirm Rejection</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-3 mt-3 border-t border-white/5">
                        <button type="button" onClick={() => { setRejectingAppId(app.id); setRejectAppNote('') }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
                          <XCircle size={14}/> Reject
                        </button>
                        <button type="button" onClick={() => approveApplication(app)} disabled={approvingId === app.id}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl bg-teal-400 text-[#0D1B2A] hover:bg-teal-300 transition-all disabled:opacity-50">
                          <CheckCircle2 size={14}/> {approvingId === app.id ? 'Approving…' : 'Approve & Invite'}
                        </button>
                        <button type="button" onClick={() => deleteApplication(app)} title="Delete"
                          className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all">
                          <Trash2 size={15}/>
                        </button>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {inviteRole && (
        <InviteModal role={inviteRole} onClose={() => setInviteRole(null)}
          onSent={() => { setInviteRole(null); loadAll() }}/>
      )}

      {editingGuardian && (
        <GuardianEditModal guardian={editingGuardian} relationships={relationships}
          onClose={() => setEditingGuardian(null)}
          onSave={patch => saveGuardianEdit(editingGuardian.id, patch)}/>
      )}

      {invitingGuardian && (
        <GuardianInviteModal guardian={invitingGuardian}
          onClose={() => setInvitingGuardian(null)}
          onSend={email => sendGuardianInvite(invitingGuardian, email)}/>
      )}
    </div>
  )
}
