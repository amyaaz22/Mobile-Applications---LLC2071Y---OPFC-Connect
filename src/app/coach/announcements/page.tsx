'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import { Plus, Trash2, Megaphone } from 'lucide-react'

const TAGS = ['General', 'Admin', 'Event', 'Shop', 'Urgent']

export default function AnnouncementsPage() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', tag: 'General', target_category: 'All', is_urgent: false })
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchAnnouncements() }, [])

  async function fetchAnnouncements() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements(data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('announcements').insert({ ...form, created_by: user?.id })
    if (error) { toast.error('Failed to post'); setSaving(false); return }
    toast.success('Announcement posted!')
    setForm({ title: '', body: '', tag: 'General', target_category: 'All', is_urgent: false })
    setShowForm(false)
    setSaving(false)
    fetchAnnouncements()
  }

  async function deleteAnn(id: string) {
    if (!confirm('Delete this announcement?')) return
    await supabase.from('announcements').delete().eq('id', id)
    toast.success('Deleted')
    fetchAnnouncements()
  }

  const tagColor = (tag: string) => ({
    Admin: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    Event: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    Shop: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    Urgent: 'bg-red-500/20 text-red-300 border-red-500/30',
    General: 'bg-white/10 text-white/60 border-white/10',
  }[tag] ?? 'bg-white/10 text-white/60')

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Announcements</h1>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus size={16}/> New
        </button>
      </div>

      {/* New announcement form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 mb-6 space-y-4">
          <h2 className="text-white font-bold">New Announcement</h2>
          <input className="input" placeholder="Title" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}/>
          <textarea className="input resize-none" rows={4} placeholder="Message…" required value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}/>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label mb-1.5 block">Tag</label>
              <select className="input" value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}>
                {TAGS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">Target</label>
              <select className="input" value={form.target_category} onChange={e => setForm(f => ({ ...f, target_category: e.target.value }))}>
                <option value="All">All</option>
                <option value="U9">U9</option>
                <option value="U13">U13</option>
                <option value="First Team">First Team</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.is_urgent} onChange={e => setForm(f => ({ ...f, is_urgent: e.target.checked }))}
              className="w-4 h-4 accent-red-400"/>
            <span className="text-white/60 text-sm">Mark as urgent</span>
          </label>
          <div className="flex gap-3">
            <button type="submit" className="btn-primary flex-1" disabled={saving}>{saving ? 'Posting…' : 'Post Announcement'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      <div className="space-y-3">
        {announcements.length === 0 ? (
          <div className="card p-12 text-center text-white/30">
            <Megaphone size={40} className="mx-auto mb-3 opacity-30"/>
            <p>No announcements yet</p>
          </div>
        ) : announcements.map(a => (
          <div key={a.id} className={`card p-5 ${a.is_urgent ? 'border-red-500/20' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${a.is_urgent ? 'bg-red-400' : 'bg-teal-400'}`}/>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-white font-bold">{a.title}</h3>
                    <span className={`badge ${tagColor(a.tag)}`}>{a.tag}</span>
                    {a.target_category !== 'All' && (
                      <span className="badge bg-white/5 text-white/40 border-white/10">{a.target_category}</span>
                    )}
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{a.body}</p>
                  <p className="text-white/25 text-xs mt-2">{formatDate(a.created_at)}</p>
                </div>
              </div>
              <button onClick={() => deleteAnn(a.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                <Trash2 size={15}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
