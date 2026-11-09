'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import ListEditor from '@/components/ListEditor'
import { useConfigList } from '@/hooks/useConfigList'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { logAudit } from '@/lib/audit'

const FALLBACK_CATEGORIES = ['U9', 'U13', 'First Team']
const FALLBACK_FORMATS = ['Small-Sided Game', '1v1', 'Rondo', 'Possession', 'Technical', 'Conditioned Game', 'Tactical', 'Other']

export default function NewDrillPage() {
  const supabase = createClient()
  const router = useRouter()
  const permitted = usePermissionGuard('drill_library')
  const categories = useConfigList('categories', FALLBACK_CATEGORIES)
  const formats = useConfigList('drill_game_formats', FALLBACK_FORMATS)

  const [name, setName] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['All'])
  const [gameFormat, setGameFormat] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [equipment, setEquipment] = useState<string[]>([])
  const [minPlayers, setMinPlayers] = useState('')
  const [maxPlayers, setMaxPlayers] = useState('')
  const [duration, setDuration] = useState('')
  const [fieldDimensions, setFieldDimensions] = useState('')
  const [description, setDescription] = useState('')
  const [setupInstructions, setSetupInstructions] = useState('')
  const [coachingPoints, setCoachingPoints] = useState('')
  const [saving, setSaving] = useState(false)

  function toggleCategory(cat: string) {
    setSelectedCategories(prev => {
      if (cat === 'All') return ['All']
      const next = prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev.filter(c => c !== 'All'), cat]
      return next.length ? next : ['All']
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Name is required'); return }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('drills').insert({
      name: name.trim(),
      categories: selectedCategories,
      game_format: gameFormat || null,
      tags,
      equipment,
      min_players: minPlayers ? parseInt(minPlayers) : null,
      max_players: maxPlayers ? parseInt(maxPlayers) : null,
      duration_minutes: duration ? parseInt(duration) : null,
      field_dimensions: fieldDimensions || null,
      description: description || null,
      setup_instructions: setupInstructions || null,
      coaching_points: coachingPoints || null,
      status: 'published',
      created_by: user?.id,
    }).select().single()
    setSaving(false)

    if (error || !data) { toast.error('Failed to save drill'); return }
    logAudit(supabase, { action: 'create', entity: 'drill', entity_id: data.id, summary: `Added drill "${name.trim()}"` })
    toast.success('Drill added')
    router.push('/coach/drill-library')
  }

  if (!permitted) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto">
      <Link href="/coach/drill-library" className="flex items-center gap-2 text-white/40 hover:text-white text-sm mb-4 transition-colors">
        <ArrowLeft size={16}/> Drill Library
      </Link>
      <h1 className="page-title mb-6">Add Drill</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="label">Name *</label>
          <input className="input" placeholder="e.g. Rondo 4v1" value={name} onChange={e => setName(e.target.value)} required/>
        </div>

        <div>
          <label className="label">Categories</label>
          <div className="flex gap-2 flex-wrap">
            {['All', ...categories].map(cat => (
              <button key={cat} type="button" onClick={() => toggleCategory(cat)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border
                  ${selectedCategories.includes(cat)
                    ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                    : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Game Format</label>
          <select className="input" value={gameFormat} onChange={e => setGameFormat(e.target.value)}>
            <option value="">Select…</option>
            {formats.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Min Players</label>
            <input type="number" min={1} className="input" value={minPlayers} onChange={e => setMinPlayers(e.target.value)}/>
          </div>
          <div>
            <label className="label">Max Players</label>
            <input type="number" min={1} className="input" value={maxPlayers} onChange={e => setMaxPlayers(e.target.value)}/>
          </div>
          <div>
            <label className="label">Duration (min)</label>
            <input type="number" min={1} className="input" value={duration} onChange={e => setDuration(e.target.value)}/>
          </div>
        </div>

        <div>
          <label className="label">Field Dimensions</label>
          <input className="input" placeholder="e.g. 20m x 15m grid" value={fieldDimensions} onChange={e => setFieldDimensions(e.target.value)}/>
        </div>

        <div>
          <label className="label">Tags</label>
          <ListEditor items={tags} onChange={setTags} placeholder="e.g. Rondo, Possession, Finishing…"/>
        </div>

        <div>
          <label className="label">Equipment</label>
          <ListEditor items={equipment} onChange={setEquipment} placeholder="e.g. Cones, Bibs, Balls…"/>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea className="input min-h-[80px]" placeholder="What the drill is and what it's for…" value={description} onChange={e => setDescription(e.target.value)}/>
        </div>

        <div>
          <label className="label">Setup Instructions</label>
          <textarea className="input min-h-[80px]" placeholder="How to set it up on the pitch, team split (e.g. 5 attackers vs 3 defenders)…" value={setupInstructions} onChange={e => setSetupInstructions(e.target.value)}/>
        </div>

        <div>
          <label className="label">Coaching Points</label>
          <textarea className="input min-h-[80px]" placeholder="What to watch for / correct while running it…" value={coachingPoints} onChange={e => setCoachingPoints(e.target.value)}/>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving…' : 'Add Drill'}
          </button>
          <Link href="/coach/drill-library" className="btn-secondary flex-1 text-center">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
