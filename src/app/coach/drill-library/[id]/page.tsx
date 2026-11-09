'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Pencil, Trash2, Users, Clock, MapPin } from 'lucide-react'
import ListEditor from '@/components/ListEditor'
import { categoryColor } from '@/lib/utils'
import { useConfigList } from '@/hooks/useConfigList'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { logAudit } from '@/lib/audit'

const FALLBACK_CATEGORIES = ['U9', 'U13', 'First Team']
const FALLBACK_FORMATS = ['Small-Sided Game', '1v1', 'Rondo', 'Possession', 'Technical', 'Conditioned Game', 'Tactical', 'Other']

export default function DrillDetailPage() {
  const supabase = createClient()
  const params = useParams()
  const router = useRouter()
  const permitted = usePermissionGuard('drill_library')
  const categories = useConfigList('categories', FALLBACK_CATEGORIES)
  const formats = useConfigList('drill_game_formats', FALLBACK_FORMATS)

  const [drill, setDrill] = useState<any>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>(null)

  useEffect(() => { fetchDrill() }, [params.id])

  async function fetchDrill() {
    const { data } = await supabase.from('drills').select('*').eq('id', params.id as string).single()
    setDrill(data)
  }

  function startEdit() {
    setForm({
      name: drill.name,
      categories: drill.categories ?? ['All'],
      game_format: drill.game_format ?? '',
      tags: drill.tags ?? [],
      equipment: drill.equipment ?? [],
      min_players: drill.min_players ?? '',
      max_players: drill.max_players ?? '',
      duration_minutes: drill.duration_minutes ?? '',
      field_dimensions: drill.field_dimensions ?? '',
      description: drill.description ?? '',
      setup_instructions: drill.setup_instructions ?? '',
      coaching_points: drill.coaching_points ?? '',
    })
    setEditing(true)
  }

  function toggleCategory(cat: string) {
    setForm((prev: any) => {
      if (cat === 'All') return { ...prev, categories: ['All'] }
      const current = prev.categories as string[]
      const next = current.includes(cat) ? current.filter((c: string) => c !== cat) : [...current.filter((c: string) => c !== 'All'), cat]
      return { ...prev, categories: next.length ? next : ['All'] }
    })
  }

  async function saveEdit() {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    const { error } = await supabase.from('drills').update({
      name: form.name.trim(),
      categories: form.categories,
      game_format: form.game_format || null,
      tags: form.tags,
      equipment: form.equipment,
      min_players: form.min_players ? parseInt(form.min_players) : null,
      max_players: form.max_players ? parseInt(form.max_players) : null,
      duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes) : null,
      field_dimensions: form.field_dimensions || null,
      description: form.description || null,
      setup_instructions: form.setup_instructions || null,
      coaching_points: form.coaching_points || null,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id as string)
    setSaving(false)
    if (error) { toast.error('Failed to save'); return }
    logAudit(supabase, { action: 'update', entity: 'drill', entity_id: params.id as string, summary: `Updated drill "${form.name.trim()}"` })
    toast.success('Saved')
    setEditing(false)
    fetchDrill()
  }

  async function remove() {
    if (!confirm(`Delete "${drill.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('drills').delete().eq('id', params.id as string)
    if (error) { toast.error('Delete failed'); return }
    logAudit(supabase, { action: 'delete', entity: 'drill', entity_id: params.id as string, summary: `Deleted drill "${drill.name}"` })
    toast.success('Deleted')
    router.push('/coach/drill-library')
  }

  if (!permitted || !drill) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Link href="/coach/drill-library" className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-4 transition-colors">
        <ArrowLeft size={16}/> Drill Library
      </Link>

      {!editing ? (
        <>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="page-title">{drill.name}</h1>
            <div className="flex gap-2 flex-shrink-0">
              <button onClick={startEdit} className="btn-secondary flex items-center gap-2 text-sm"><Pencil size={14}/> Edit</button>
              <button onClick={remove} className="btn-danger flex items-center gap-2 text-sm"><Trash2 size={14}/></button>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap mb-5">
            {(drill.categories ?? []).map((c: string) => <span key={c} className={`badge text-xs ${categoryColor(c)}`}>{c}</span>)}
            {drill.game_format && <span className="badge bg-white/5 border-white/10 text-white/50 text-xs">{drill.game_format}</span>}
          </div>

          <div className="card p-5 mb-4 flex items-center gap-5 text-white/60 text-sm flex-wrap">
            {(drill.min_players || drill.max_players) && (
              <span className="flex items-center gap-2"><Users size={15} className="text-teal-400"/>
                {drill.min_players && drill.max_players ? `${drill.min_players}-${drill.max_players}` : drill.min_players ?? drill.max_players} players
              </span>
            )}
            {drill.duration_minutes && <span className="flex items-center gap-2"><Clock size={15} className="text-teal-400"/>{drill.duration_minutes} min</span>}
            {drill.field_dimensions && <span className="flex items-center gap-2"><MapPin size={15} className="text-teal-400"/>{drill.field_dimensions}</span>}
          </div>

          {drill.description && (
            <div className="card p-5 mb-4">
              <h2 className="section-title mb-2">Description</h2>
              <p className="text-white/70 text-sm whitespace-pre-wrap">{drill.description}</p>
            </div>
          )}
          {drill.setup_instructions && (
            <div className="card p-5 mb-4">
              <h2 className="section-title mb-2">Setup</h2>
              <p className="text-white/70 text-sm whitespace-pre-wrap">{drill.setup_instructions}</p>
            </div>
          )}
          {drill.coaching_points && (
            <div className="card p-5 mb-4">
              <h2 className="section-title mb-2">Coaching Points</h2>
              <p className="text-white/70 text-sm whitespace-pre-wrap">{drill.coaching_points}</p>
            </div>
          )}
          {(drill.equipment ?? []).length > 0 && (
            <div className="card p-5 mb-4">
              <h2 className="section-title mb-2">Equipment</h2>
              <div className="flex gap-2 flex-wrap">
                {drill.equipment.map((e: string) => <span key={e} className="badge bg-white/5 border-white/10 text-white/50 text-xs">{e}</span>)}
              </div>
            </div>
          )}
          {(drill.tags ?? []).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {drill.tags.map((t: string) => <span key={t} className="text-white/30 text-xs">#{t}</span>)}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-5">
          <h1 className="page-title mb-2">Edit Drill</h1>

          <div>
            <label className="label">Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
          </div>

          <div>
            <label className="label">Categories</label>
            <div className="flex gap-2 flex-wrap">
              {['All', ...categories].map(cat => (
                <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border
                    ${form.categories.includes(cat)
                      ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Game Format</label>
            <select className="input" value={form.game_format} onChange={e => setForm({ ...form, game_format: e.target.value })}>
              <option value="">Select…</option>
              {formats.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Min Players</label>
              <input type="number" min={1} className="input" value={form.min_players} onChange={e => setForm({ ...form, min_players: e.target.value })}/>
            </div>
            <div>
              <label className="label">Max Players</label>
              <input type="number" min={1} className="input" value={form.max_players} onChange={e => setForm({ ...form, max_players: e.target.value })}/>
            </div>
            <div>
              <label className="label">Duration (min)</label>
              <input type="number" min={1} className="input" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: e.target.value })}/>
            </div>
          </div>

          <div>
            <label className="label">Field Dimensions</label>
            <input className="input" value={form.field_dimensions} onChange={e => setForm({ ...form, field_dimensions: e.target.value })}/>
          </div>

          <div>
            <label className="label">Tags</label>
            <ListEditor items={form.tags} onChange={tags => setForm({ ...form, tags })}/>
          </div>

          <div>
            <label className="label">Equipment</label>
            <ListEditor items={form.equipment} onChange={equipment => setForm({ ...form, equipment })}/>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea className="input min-h-[80px]" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/>
          </div>

          <div>
            <label className="label">Setup Instructions</label>
            <textarea className="input min-h-[80px]" value={form.setup_instructions} onChange={e => setForm({ ...form, setup_instructions: e.target.value })}/>
          </div>

          <div>
            <label className="label">Coaching Points</label>
            <textarea className="input min-h-[80px]" value={form.coaching_points} onChange={e => setForm({ ...form, coaching_points: e.target.value })}/>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={saveEdit} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Changes'}</button>
            <button onClick={() => setEditing(false)} className="btn-secondary flex-1">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
