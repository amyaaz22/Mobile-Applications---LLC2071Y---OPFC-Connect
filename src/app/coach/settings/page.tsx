'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { Save, Plus, Trash2, Upload } from 'lucide-react'

export default function ClubSettingsPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
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
  const [newCategory, setNewCategory] = useState('')

  // Fees
  const [entryFee, setEntryFee] = useState(300)
  const [monthlyFees, setMonthlyFees] = useState<Record<string, number>>({ 'U9': 200, 'U13': 200, 'First Team': 200 })

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: fees }, { data: info }] = await Promise.all([
        supabase.from('club_settings').select('value').eq('key', 'categories').single(),
        supabase.from('club_settings').select('value').eq('key', 'fees').single(),
        supabase.from('club_settings').select('value').eq('key', 'club_info').single(),
      ])
      if (cats?.value) setCategories(cats.value as string[])
      if (fees?.value) {
        const f = fees.value as any
        setEntryFee(f.entry ?? 300)
        setMonthlyFees(f.monthly ?? {})
      }
      if (info?.value) {
        const i = info.value as any
        setClubName(i.name ?? '')
        setClubMotto(i.motto ?? '')
        setClubLocation(i.location ?? '')
        setLogoUrl(i.logo_url ?? '')
      }
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

  function addCategory() {
    const t = newCategory.trim()
    if (!t || categories.includes(t)) return
    const updated = [...categories, t]
    setCategories(updated)
    setMonthlyFees(f => ({ ...f, [t]: 200 }))
    setNewCategory('')
  }

  function removeCategory(cat: string) {
    setCategories(c => c.filter(x => x !== cat))
    setMonthlyFees(f => { const n = { ...f }; delete n[cat]; return n })
  }

  function renameCategory(old: string, next: string) {
    setCategories(c => c.map(x => x === old ? next : x))
    setMonthlyFees(f => {
      const n = { ...f }
      n[next] = n[old]
      delete n[old]
      return n
    })
  }

  async function saveAll() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const uid = user?.id

    const updates = [
      supabase.from('club_settings').upsert({ key: 'categories', value: categories as any, updated_by: uid, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      supabase.from('club_settings').upsert({ key: 'fees', value: { entry: entryFee, monthly: monthlyFees } as any, updated_by: uid, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
      supabase.from('club_settings').upsert({ key: 'club_info', value: { name: clubName, motto: clubMotto, location: clubLocation, logo_url: logoUrl } as any, updated_by: uid, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
    ]

    const results = await Promise.all(updates)
    const errors = results.filter(r => r.error)
    if (errors.length) { toast.error('Some settings failed to save'); setSaving(false); return }
    toast.success('Settings saved!')
    setSaving(false)
  }

  if (loading) return (
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
        <div className="space-y-2 mb-4">
          {categories.map(cat => (
            <div key={cat} className="flex items-center gap-3">
              <input
                className="input flex-1"
                defaultValue={cat}
                onBlur={e => { if (e.target.value !== cat) renameCategory(cat, e.target.value) }}
              />
              <button onClick={() => removeCategory(cat)}
                className="p-2 text-red-400/50 hover:text-red-400 transition-colors rounded-lg hover:bg-red-400/10">
                <Trash2 size={15}/>
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input className="input flex-1" placeholder="New category name…" value={newCategory} onChange={e => setNewCategory(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}/>
          <button onClick={addCategory} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={14}/> Add
          </button>
        </div>
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

      <button onClick={saveAll} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        <Save size={16}/>{saving ? 'Saving…' : 'Save All Settings'}
      </button>
    </div>
  )
}
