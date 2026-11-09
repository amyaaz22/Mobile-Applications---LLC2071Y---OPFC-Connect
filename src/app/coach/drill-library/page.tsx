'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Plus, BookOpen, Search, Trash2, Users, Clock } from 'lucide-react'
import { categoryColor } from '@/lib/utils'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { logAudit } from '@/lib/audit'

const FALLBACK_CATEGORIES = ['U9', 'U13', 'First Team']

export default function DrillLibraryPage() {
  const supabase = createClient()
  const permitted = usePermissionGuard('drill_library')
  const [drills, setDrills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES)

  useEffect(() => {
    supabase.from('club_settings').select('value').eq('key', 'categories').single()
      .then(({ data }) => { if (data?.value) setCategories(data.value as string[]) })
    fetchDrills()
  }, [])

  async function fetchDrills() {
    setLoading(true)
    const { data } = await supabase
      .from('drills')
      .select('*')
      .eq('status', 'published')
      .order('name')
    setDrills(data ?? [])
    setLoading(false)
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('drills').delete().eq('id', id)
    if (error) { toast.error('Delete failed'); return }
    logAudit(supabase, { action: 'delete', entity: 'drill', entity_id: id, summary: `Deleted drill "${name}"` })
    toast.success('Deleted')
    fetchDrills()
  }

  const filtered = drills.filter(d => {
    if (category !== 'All' && !(d.categories ?? []).includes(category) && !(d.categories ?? []).includes('All')) return false
    if (search && !d.name.toLowerCase().includes(search.toLowerCase()) && !(d.tags ?? []).some((t: string) => t.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })

  if (!permitted) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Drill Library</h1>
          <p className="text-white/30 text-sm mt-1">{drills.length} drill{drills.length === 1 ? '' : 's'} — shared across every coach</p>
        </div>
        <Link href="/coach/drill-library/new" className="btn-primary flex items-center gap-2 text-sm self-start">
          <Plus size={14}/> Add Drill
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
          <input
            type="text"
            className="input pl-9"
            placeholder="Search by name or tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['All', ...categories].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border
                ${category === cat
                  ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/30 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-white/30">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30"/>
          <p className="mb-4">{drills.length === 0 ? 'No drills yet' : 'No drills match your filters'}</p>
          {drills.length === 0 && <Link href="/coach/drill-library/new" className="btn-primary text-sm">Add Your First Drill</Link>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(d => (
            <div key={d.id} className="card p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/coach/drill-library/${d.id}`} className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{d.name}</p>
                </Link>
                <button onClick={() => remove(d.id, d.name)} className="text-white/20 hover:text-red-400 transition-colors p-1 flex-shrink-0" title="Delete">
                  <Trash2 size={14}/>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {(d.categories ?? []).map((c: string) => (
                  <span key={c} className={`badge text-xs ${categoryColor(c)}`}>{c}</span>
                ))}
                {d.game_format && <span className="badge bg-white/5 border-white/10 text-white/50 text-xs">{d.game_format}</span>}
              </div>
              {d.description && <p className="text-white/40 text-xs line-clamp-2 mb-2">{d.description}</p>}
              <div className="flex items-center gap-3 text-white/30 text-xs">
                {(d.min_players || d.max_players) && (
                  <span className="flex items-center gap-1"><Users size={11}/>
                    {d.min_players && d.max_players ? `${d.min_players}-${d.max_players}` : d.min_players ?? d.max_players} players
                  </span>
                )}
                {d.duration_minutes && <span className="flex items-center gap-1"><Clock size={11}/>{d.duration_minutes} min</span>}
                {(d.tags ?? []).slice(0, 3).map((t: string) => <span key={t} className="text-white/20">#{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
