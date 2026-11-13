'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { Save, Upload, ChevronDown, Link2, Clock } from 'lucide-react'
import ListEditor from '@/components/ListEditor'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { logAudit } from '@/lib/audit'

const DEFAULT_LISTS: Record<string, string[]> = {
  positions: ['GK', 'DEF', 'MID', 'FWD'],
  guardian_relationships: ['Father', 'Mother', 'Uncle', 'Aunt', 'Sibling', 'Other'],
  announcement_tags: ['General', 'Admin', 'Event', 'Shop', 'Urgent'],
  payment_methods: ['Cash', 'Bank Transfer', 'Mobile Money', 'Other'],
  expense_categories: ['Equipment', 'Referee Fees', 'Transport', 'Medical', 'Venue / Pitch Hire', 'Administration', 'Other'],
  income_sources: ['Donation', 'Sponsorship', 'Fundraiser', 'Grant', 'Other'],
  inventory_categories: ['Jerseys', 'Balls', 'Training Equipment', 'Goals & Nets', 'Medical Kit', 'Bibs & Cones', 'Other'],
  inventory_conditions: ['New', 'Good', 'Worn', 'Damaged'],
  drill_game_formats: ['Small-Sided Game', '1v1', 'Rondo', 'Possession', 'Technical', 'Conditioned Game', 'Tactical', 'Other'],
}

const LIST_LABELS: Record<string, { title: string; hint: string }> = {
  positions: { title: 'Player Positions', hint: 'Used on player registration and edit forms.' },
  guardian_relationships: { title: 'Guardian Relationships', hint: 'Used when registering a player\'s parent/guardian.' },
  announcement_tags: { title: 'Announcement Tags', hint: 'Used when posting a club announcement.' },
  payment_methods: { title: 'Payment Methods', hint: 'Used when recording a payment.' },
  expense_categories: { title: 'Expense Categories', hint: 'Used when recording a club expense.' },
  income_sources: { title: 'Income Sources', hint: 'Used when recording a donation or other income.' },
  inventory_categories: { title: 'Inventory Categories', hint: 'Used when adding an inventory item.' },
  inventory_conditions: { title: 'Inventory Conditions', hint: 'Used when adding or editing an inventory item.' },
  drill_game_formats: { title: 'Drill Game Formats', hint: 'Used when adding a drill to the Drill Library.' },
}

// <input type="datetime-local"> works in local wall-clock time with no
// timezone info; club_settings stores ISO (UTC) strings so the
// registration_window_open() SQL function can compare them against
// `now()` directly. These two convert between the two without the
// off-by-timezone bugs of doing it inline at every call site.
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
function localInputToIso(local: string): string | null {
  if (!local) return null
  return new Date(local).toISOString()
}

type RegWindow = { opens_at: string; closes_at: string } // datetime-local strings, '' = no bound

function windowStatusLabel(w: RegWindow): { text: string; cls: string } {
  const now = new Date()
  const opens = w.opens_at ? new Date(w.opens_at) : null
  const closes = w.closes_at ? new Date(w.closes_at) : null
  if (opens && opens > now) return { text: 'Not yet open', cls: 'bg-white/5 text-white/40 border-white/10' }
  if (closes && closes < now) return { text: 'Closed', cls: 'bg-red-500/15 text-red-300 border-red-500/25' }
  return { text: 'Open', cls: 'bg-green-500/15 text-green-300 border-green-500/25' }
}

function RegistrationWindowCard({
  title, hint, path, value, onChange,
}: {
  title: string; hint: string; path: string; value: RegWindow; onChange: (w: RegWindow) => void
}) {
  const status = windowStatusLabel(value)
  const linkUrl = typeof window !== 'undefined' ? `${window.location.origin}${path}` : path
  return (
    <div className="card p-5 mb-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-white font-bold text-sm flex items-center gap-2">
            <Link2 size={14} className="text-teal-400"/>{title}
          </h3>
          <p className="text-white/30 text-xs mt-0.5">{hint}</p>
        </div>
        <span className={`badge text-xs flex-shrink-0 ${status.cls}`}>{status.text}</span>
      </div>
      <a href={path} target="_blank" rel="noopener noreferrer" className="text-teal-400/70 hover:text-teal-400 text-xs font-mono block mb-4 truncate">
        {linkUrl}
      </a>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1.5 block">Opens</label>
          <input type="datetime-local" className="input text-sm" value={value.opens_at}
            onChange={e => onChange({ ...value, opens_at: e.target.value })}/>
        </div>
        <div>
          <label className="label mb-1.5 block">Closes</label>
          <input type="datetime-local" className="input text-sm" value={value.closes_at}
            onChange={e => onChange({ ...value, closes_at: e.target.value })}/>
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-white/25 text-xs">Leave either blank for no limit on that side. Enforced server-side — a closed link rejects submissions even via a direct API call.</p>
        <button type="button" onClick={() => onChange({ ...value, closes_at: isoToLocalInput(new Date().toISOString()) })}
          className="text-red-300/70 hover:text-red-300 text-xs font-semibold flex items-center gap-1 flex-shrink-0 ml-3">
          <Clock size={12}/> Close now
        </button>
      </div>
    </div>
  )
}

function CollapsibleListCard({ listKey, items, onChange }: { listKey: string; items: string[]; onChange: (items: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const { title, hint } = LIST_LABELS[listKey]
  return (
    <div className="card p-5 mb-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-left">
        <div>
          <h3 className="text-white font-bold text-sm">{title}</h3>
          <p className="text-white/30 text-xs mt-0.5">{items.length} option{items.length === 1 ? '' : 's'}</p>
        </div>
        <ChevronDown size={16} className={`text-white/30 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && (
        <div className="mt-4 pt-4 border-t border-white/5">
          <p className="text-white/30 text-xs mb-3">{hint}</p>
          <ListEditor items={items} onChange={onChange}/>
        </div>
      )}
    </div>
  )
}

export default function ClubSettingsPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const permitted = usePermissionGuard('settings')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)

  // Club info
  const [clubName, setClubName] = useState('Oasis Pailles Football Club')
  const [clubMotto, setClubMotto] = useState('Omnis Tactus, Officium')
  const [clubLocation, setClubLocation] = useState('Morcellement Raffray, Pailles')
  const [logoUrl, setLogoUrl] = useState('')

  // Categories
  const [categories, setCategories] = useState<string[]>(['U9', 'U13', 'First Team'])

  // Fees
  const [entryFee, setEntryFee] = useState(300)
  const [monthlyFees, setMonthlyFees] = useState<Record<string, number>>({ 'U9': 200, 'U13': 200, 'First Team': 200 })

  // Configurable dropdown lists
  const [lists, setLists] = useState<Record<string, string[]>>(DEFAULT_LISTS)

  // Public registration link windows (/apply, /apply/coach)
  const [playerRegWindow, setPlayerRegWindow] = useState<RegWindow>({ opens_at: '', closes_at: '' })
  const [coachRegWindow, setCoachRegWindow] = useState<RegWindow>({ opens_at: '', closes_at: '' })

  useEffect(() => {
    async function load() {
      const keys = ['categories', 'fees', 'club_info', 'player_registration', 'coach_registration', ...Object.keys(DEFAULT_LISTS)]
      const { data } = await supabase.from('club_settings').select('key, value').in('key', keys)
      const byKey: Record<string, any> = {}
      data?.forEach(row => { byKey[row.key] = row.value })

      if (byKey.categories) setCategories(byKey.categories as string[])
      if (byKey.fees) {
        setEntryFee(byKey.fees.entry ?? 300)
        setMonthlyFees(byKey.fees.monthly ?? {})
      }
      if (byKey.club_info) {
        setClubName(byKey.club_info.name ?? '')
        setClubMotto(byKey.club_info.motto ?? '')
        setClubLocation(byKey.club_info.location ?? '')
        setLogoUrl(byKey.club_info.logo_url ?? '')
      }
      if (byKey.player_registration) setPlayerRegWindow({
        opens_at: isoToLocalInput(byKey.player_registration.opens_at), closes_at: isoToLocalInput(byKey.player_registration.closes_at),
      })
      if (byKey.coach_registration) setCoachRegWindow({
        opens_at: isoToLocalInput(byKey.coach_registration.opens_at), closes_at: isoToLocalInput(byKey.coach_registration.closes_at),
      })
      setLists(prev => {
        const next = { ...prev }
        Object.keys(DEFAULT_LISTS).forEach(key => { if (byKey[key]) next[key] = byKey[key] as string[] })
        return next
      })
      setLoading(false)
    }
    load()
  }, [])

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoUploading(true)
    const { error } = await supabase.storage.from('avatars').upload('club/logo.png', file, { upsert: true })
    if (error) { toast.error('Upload failed'); setLogoUploading(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl('club/logo.png')
    setLogoUrl(publicUrl + '?t=' + Date.now())
    setLogoUploading(false)
    toast.success('Logo uploaded!')
  }

  function updateCategories(next: string[]) {
    setMonthlyFees(f => {
      const n: Record<string, number> = {}
      next.forEach(cat => { n[cat] = f[cat] ?? 200 })
      return n
    })
    setCategories(next)
  }

  async function saveAll() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id
    const now = new Date().toISOString()

    const updates = [
      supabase.from('club_settings').upsert({ key: 'categories', value: categories as any, updated_by: uid, updated_at: now }, { onConflict: 'key' }),
      supabase.from('club_settings').upsert({ key: 'fees', value: { entry: entryFee, monthly: monthlyFees } as any, updated_by: uid, updated_at: now }, { onConflict: 'key' }),
      supabase.from('club_settings').upsert({ key: 'club_info', value: { name: clubName, motto: clubMotto, location: clubLocation, logo_url: logoUrl } as any, updated_by: uid, updated_at: now }, { onConflict: 'key' }),
      supabase.from('club_settings').upsert({ key: 'player_registration', value: { opens_at: localInputToIso(playerRegWindow.opens_at), closes_at: localInputToIso(playerRegWindow.closes_at) } as any, updated_by: uid, updated_at: now }, { onConflict: 'key' }),
      supabase.from('club_settings').upsert({ key: 'coach_registration', value: { opens_at: localInputToIso(coachRegWindow.opens_at), closes_at: localInputToIso(coachRegWindow.closes_at) } as any, updated_by: uid, updated_at: now }, { onConflict: 'key' }),
      ...Object.entries(lists).map(([key, value]) =>
        supabase.from('club_settings').upsert({ key, value: value as any, updated_by: uid, updated_at: now }, { onConflict: 'key' })
      ),
    ]

    const results = await Promise.all(updates)
    const errors = results.filter(r => r.error)
    if (errors.length) { toast.error('Some settings failed to save'); setSaving(false); return }
    logAudit(supabase, { action: 'update', entity: 'settings', summary: 'Updated Club Settings (categories/fees/club info/registration windows/dropdown lists)' })
    toast.success('Settings saved!')
    setSaving(false)
  }

  if (loading || !permitted) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Club Settings</h1>
        <button onClick={saveAll} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={16}/>{saving ? 'Saving…' : 'Save All'}
        </button>
      </div>

      {/* Club Info */}
      <div className="card p-5 mb-5">
        <h2 className="section-title mb-4">Club Information</h2>
        <div className="space-y-4">
          {/* Logo */}
          <div>
            <label className="label mb-2 block">Club Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Club logo" className="w-full h-full object-contain p-1"/>
                ) : (
                  <span className="text-white/20 text-xs text-center">No logo</span>
                )}
              </div>
              <div>
                <button onClick={() => fileRef.current?.click()} disabled={logoUploading}
                  className="btn-secondary flex items-center gap-2 text-sm">
                  <Upload size={14}/>{logoUploading ? 'Uploading…' : 'Upload Logo'}
                </button>
                <p className="text-white/25 text-xs mt-1">PNG or SVG recommended</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/>
          </div>

          <div>
            <label className="label mb-1.5 block">Club Name</label>
            <input className="input" value={clubName} onChange={e => setClubName(e.target.value)}/>
          </div>
          <div>
            <label className="label mb-1.5 block">Motto</label>
            <input className="input" value={clubMotto} onChange={e => setClubMotto(e.target.value)}/>
          </div>
          <div>
            <label className="label mb-1.5 block">Location</label>
            <input className="input" value={clubLocation} onChange={e => setClubLocation(e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="card p-5 mb-5">
        <h2 className="section-title mb-4">Player Categories</h2>
        <p className="text-white/30 text-xs mb-4">Changes reflect everywhere — dropdowns, filters, session creation.</p>
        <ListEditor items={categories} onChange={updateCategories} placeholder="New category name…"/>
      </div>

      {/* Fees */}
      <div className="card p-5 mb-5">
        <h2 className="section-title mb-4">Fee Structure (Rs)</h2>
        <div className="space-y-4">
          <div>
            <label className="label mb-1.5 block">Entry Fee (one-time, per player)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rs</span>
              <input type="number" className="input pl-10" value={entryFee} onChange={e => setEntryFee(+e.target.value)}/>
            </div>
          </div>
          <div>
            <label className="label mb-3 block">Monthly Fee per Category</label>
            <div className="space-y-3">
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-3">
                  <span className="text-white text-sm w-28 flex-shrink-0">{cat}</span>
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rs</span>
                    <input type="number" className="input pl-10"
                      value={monthlyFees[cat] ?? 200}
                      onChange={e => setMonthlyFees(f => ({ ...f, [cat]: +e.target.value }))}/>
                  </div>
                  <span className="text-white/30 text-xs w-16">per month</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Public registration links */}
      <div className="mb-2">
        <h2 className="section-title mb-1">Public Registration Links</h2>
        <p className="text-white/30 text-xs mb-4">Control when the public self-service forms accept submissions — set a window to prevent spam when you're not actively recruiting.</p>
      </div>
      <RegistrationWindowCard title="Player Registration" hint="/apply — replaces the old Google Form" path="/apply"
        value={playerRegWindow} onChange={setPlayerRegWindow}/>
      <RegistrationWindowCard title="Coach Applications" hint="/apply/coach — reviewed from Staff & Parents → Applications" path="/apply/coach"
        value={coachRegWindow} onChange={setCoachRegWindow}/>

      {/* Configurable dropdown lists */}
      <div className="mb-2 mt-5">
        <h2 className="section-title mb-1">Dropdown Lists</h2>
        <p className="text-white/30 text-xs mb-4">Every list below feeds a dropdown elsewhere in the app — add, rename, or remove options without touching code.</p>
      </div>
      {Object.keys(DEFAULT_LISTS).map(key => (
        <CollapsibleListCard key={key} listKey={key} items={lists[key] ?? []}
          onChange={next => setLists(l => ({ ...l, [key]: next }))}/>
      ))}

      <button onClick={saveAll} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2 mt-3">
        <Save size={16}/>{saving ? 'Saving…' : 'Save All Settings'}
      </button>
    </div>
  )
}
