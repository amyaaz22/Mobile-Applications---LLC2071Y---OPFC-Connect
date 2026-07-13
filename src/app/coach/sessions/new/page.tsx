'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewSessionPage() {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    title: '',
    session_type: 'training',
    category: 'All',
    date: new Date().toISOString().split('T')[0],
    time_start: '17:00',
    duration_minutes: 90,
    venue: 'Morcellement Raffray Football Ground',
    notes: '',
  })

  function set(key: string, val: any) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('training_sessions').insert({ ...form, created_by: user?.id })
    if (error) { toast.error('Failed to create session'); setSaving(false); return }
    toast.success('Session created!')
    router.push('/coach/sessions')
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Link href="/coach/sessions" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> Sessions
      </Link>
      <h1 className="page-title mb-6">New Session</h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-5">
        <div>
          <label className="label mb-1.5 block">Session Title</label>
          <input className="input" required value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="e.g. Tuesday Training — U13"/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-1.5 block">Type</label>
            <select className="input" value={form.session_type} onChange={e => set('session_type', e.target.value)}>
              <option value="training">Training</option>
              <option value="match">Match</option>
              <option value="tournament">Tournament</option>
            </select>
          </div>
          <div>
            <label className="label mb-1.5 block">Category</label>
            <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="All">All</option>
              <option value="U9">U9</option>
              <option value="U13">U13</option>
              <option value="First Team">First Team</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-1.5 block">Date</label>
            <input type="date" className="input" required value={form.date} onChange={e => set('date', e.target.value)}/>
          </div>
          <div>
            <label className="label mb-1.5 block">Start Time</label>
            <input type="time" className="input" required value={form.time_start} onChange={e => set('time_start', e.target.value)}/>
          </div>
        </div>

        <div>
          <label className="label mb-1.5 block">Duration (minutes)</label>
          <div className="flex gap-2">
            {[60, 90, 120].map(d => (
              <button key={d} type="button" onClick={() => set('duration_minutes', d)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all
                  ${form.duration_minutes === d ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:border-white/20'}`}>
                {d}min
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label mb-1.5 block">Venue</label>
          <input className="input" value={form.venue} onChange={e => set('venue', e.target.value)}/>
        </div>

        <div>
          <label className="label mb-1.5 block">Notes (optional)</label>
          <textarea className="input resize-none" rows={3} value={form.notes}
            onChange={e => set('notes', e.target.value)} placeholder="e.g. Bring full kit, evaluation session…"/>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" className="btn-primary flex-1" disabled={saving}>
            {saving ? 'Creating…' : 'Create Session'}
          </button>
          <Link href="/coach/sessions" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
