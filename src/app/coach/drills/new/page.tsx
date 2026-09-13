'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Plus, X } from 'lucide-react'
import Link from 'next/link'

function slugify(label: string, existing: string[]) {
  let base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'col'
  let key = base
  let i = 1
  while (existing.includes(key)) key = `${base}_${++i}`
  return key
}

export default function NewDrillSheetPage() {
  const supabase = createClient()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [columns, setColumns] = useState<{ key: string; label: string }[]>([{ key: 'notes', label: 'Notes' }])
  const [newColumn, setNewColumn] = useState('')

  useEffect(() => {
    supabase.from('club_settings').select('value').eq('key', 'categories').single()
      .then(({ data }) => { if (data?.value) setCategories(data.value as string[]) })
    supabase.from('training_sessions').select('id, title, date, category').order('date', { ascending: false }).limit(30)
      .then(({ data }) => setSessions(data ?? []))
    supabase.from('players').select('id, full_name, player_code, category').eq('is_active', true).order('full_name')
      .then(({ data }) => setPlayers(data ?? []))
  }, [])

  function applyCategory(cat: string) {
    setCategory(cat)
    if (!cat) return
    const next: Record<string, boolean> = { ...selected }
    players.filter(p => p.category === cat).forEach(p => { next[p.id] = true })
    setSelected(next)
  }

  function applySession(id: string) {
    setSessionId(id)
    const session = sessions.find(s => s.id === id)
    if (session?.category && session.category !== 'All') applyCategory(session.category)
  }

  function addColumn() {
    const label = newColumn.trim()
    if (!label) return
    setColumns(c => [...c, { key: slugify(label, c.map(x => x.key)), label }])
    setNewColumn('')
  }

  function removeColumn(key: string) {
    setColumns(c => c.filter(x => x.key !== key))
  }

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k)

  async function create() {
    if (!title.trim()) { toast.error('Give the sheet a title'); return }
    if (!selectedIds.length) { toast.error('Select at least one player'); return }
    if (!columns.length) { toast.error('Add at least one column'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('field_sheets').insert({
      title: title.trim(),
      category: category || null,
      session_id: sessionId || null,
      columns,
      player_ids: selectedIds,
      data: {},
      created_by: user?.id,
    }).select().single()
    setSaving(false)
    if (error || !data) { toast.error('Failed to create sheet'); return }
    toast.success('Sheet created!')
    router.push(`/coach/drills/${data.id}`)
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Link href="/coach/drills" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> Field Sheets
      </Link>
      <h1 className="page-title mb-6">New Field Sheet</h1>

      <div className="card p-6 space-y-5">
        <div>
          <label className="label mb-1.5 block">Title *</label>
          <input className="input" placeholder="e.g. Dribbling Drill — Cone Weave" value={title} onChange={e => setTitle(e.target.value)}/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label mb-1.5 block">Category (optional)</label>
            <select className="input" value={category} onChange={e => applyCategory(e.target.value)}>
              <option value="">— None —</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-white/25 text-xs mt-1">Pre-selects that group's players below.</p>
          </div>
          <div>
            <label className="label mb-1.5 block">Link to Session (optional)</label>
            <select className="input" value={sessionId} onChange={e => applySession(e.target.value)}>
              <option value="">— None —</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.title} — {formatShort(s.date)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label mb-2 block">Columns</label>
          <div className="space-y-1.5 mb-2">
            {columns.map(col => (
              <div key={col.key} className="flex items-center gap-2 bg-white/3 rounded-lg px-3 py-2">
                <span className="text-white text-sm flex-1">{col.label}</span>
                <button onClick={() => removeColumn(col.key)} className="text-white/20 hover:text-red-400 transition-colors">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="e.g. Reps, Time, Success Rate…" value={newColumn}
              onChange={e => setNewColumn(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColumn())}/>
            <button type="button" onClick={addColumn} className="btn-secondary flex items-center gap-2 text-sm">
              <Plus size={14}/> Add
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label">Players ({selectedIds.length} selected)</label>
            <button type="button" onClick={() => {
              const allSelected = players.every(p => selected[p.id])
              const next: Record<string, boolean> = {}
              players.forEach(p => { next[p.id] = !allSelected })
              setSelected(next)
            }} className="text-teal-400 text-xs hover:underline">
              {players.every(p => selected[p.id]) ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {players.map(p => (
              <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all
                ${selected[p.id] ? 'bg-teal-400/10 border border-teal-400/20' : 'hover:bg-white/5 border border-transparent'}`}>
                <input type="checkbox" className="accent-teal-400 w-4 h-4"
                  checked={!!selected[p.id]}
                  onChange={e => setSelected(s => ({ ...s, [p.id]: e.target.checked }))}/>
                <span className="text-white text-sm flex-1">{p.full_name}</span>
                <span className="text-white/30 text-xs">{p.category}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={create} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Creating…' : 'Create Sheet →'}
          </button>
          <Link href="/coach/drills" className="btn-secondary">Cancel</Link>
        </div>
      </div>
    </div>
  )
}

function formatShort(date: string) {
  return new Date(date).toLocaleDateString('en', { day: 'numeric', month: 'short' })
}
