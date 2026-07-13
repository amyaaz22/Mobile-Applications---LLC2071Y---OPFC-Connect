'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { LogOut, Save, Shield } from 'lucide-react'

export default function CoachProfilePage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ players: 0, sessions: 0, announcements: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(p)
      setName(p?.full_name ?? '')

      const [{ count: pc }, { count: sc }, { count: ac }] = await Promise.all([
        supabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('training_sessions').select('*', { count: 'exact', head: true }),
        supabase.from('announcements').select('*', { count: 'exact', head: true }),
      ])
      setStats({ players: pc ?? 0, sessions: sc ?? 0, announcements: ac ?? 0 })
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', profile.id)
    if (error) { toast.error('Failed to save'); setSaving(false); return }
    toast.success('Profile updated!')
    setSaving(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!profile) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <h1 className="page-title mb-6">Profile & Settings</h1>

      {/* Avatar */}
      <div className="card p-6 mb-5 flex items-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-teal-400/10 border border-teal-400/20 flex items-center justify-center flex-shrink-0">
          <span className="text-teal-400 font-black text-3xl font-condensed">{name[0]?.toUpperCase()}</span>
        </div>
        <div>
          <h2 className="text-white font-bold text-xl">{profile.full_name}</h2>
          <p className="text-white/40 text-sm">{profile.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <Shield size={12} className="text-teal-400"/>
            <span className="text-teal-400 text-xs font-semibold capitalize">{profile.role}</span>
          </div>
        </div>
      </div>

      {/* Club stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Players', value: stats.players },
          { label: 'Sessions', value: stats.sessions },
          { label: 'Posts', value: stats.announcements },
        ].map(({ label, value }) => (
          <div key={label} className="card p-4 text-center">
            <div className="text-2xl font-black font-condensed text-teal-400">{value}</div>
            <div className="text-white/40 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Edit name */}
      <form onSubmit={handleSave} className="card p-5 mb-5 space-y-4">
        <h2 className="section-title">Account Settings</h2>
        <div>
          <label className="label mb-1.5 block">Display Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} required/>
        </div>
        <div>
          <label className="label mb-1.5 block">Email</label>
          <input className="input" value={profile.email} disabled
            title="Email cannot be changed here"/>
        </div>
        <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
          <Save size={16}/>{saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>

      {/* Club info */}
      <div className="card p-5 mb-5">
        <h2 className="section-title mb-3">Club Information</h2>
        <div className="space-y-2">
          {[
            ['Club', 'Oasis Pailles Football Club'],
            ['Location', 'Morcellement Raffray, Pailles'],
            ['Motto', 'Omnis Tactus, Officium'],
            ['Categories', 'U9 · U13 · First Team'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
              <span className="text-white/40 text-sm">{label}</span>
              <span className="text-white text-sm">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Logout */}
      <button onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all">
        <LogOut size={16}/> Sign Out
      </button>
    </div>
  )
}
