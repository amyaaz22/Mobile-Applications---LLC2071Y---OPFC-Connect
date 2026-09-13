'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import { Plus, ClipboardList, Trash2, Copy, Users } from 'lucide-react'
import { formatDate, categoryColor } from '@/lib/utils'

export default function DrillsPage() {
  const supabase = createClient()
  const [sheets, setSheets] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSheets() }, [])

  async function fetchSheets() {
    setLoading(true)
    const { data } = await supabase.from('field_sheets').select('*').order('updated_at', { ascending: false })
    setSheets(data ?? [])
    setLoading(false)
  }

  async function duplicate(sheet: any) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: newSheet, error } = await supabase.from('field_sheets').insert({
      title: `${sheet.title} (copy)`,
      category: sheet.category,
      session_id: null,
      columns: sheet.columns,
      player_ids: sheet.player_ids,
      data: {},
      created_by: user?.id,
    }).select().single()
    if (error || !newSheet) { toast.error('Failed to duplicate'); return }
    toast.success('Duplicated — roster and columns copied, cells cleared')
    fetchSheets()
  }

  async function remove(id: string) {
    if (!confirm('Delete this field sheet? This cannot be undone.')) return
    await supabase.from('field_sheets').delete().eq('id', id)
    toast.success('Deleted')
    fetchSheets()
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="page-title">Field Sheets</h1>
          <p className="text-white/30 text-sm mt-1">Drill worksheets — player roster + your own note-taking columns</p>
        </div>
        <Link href="/coach/drills/new" className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={14}/> New Sheet
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/30 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
        </div>
      ) : sheets.length === 0 ? (
        <div className="card p-12 text-center text-white/30">
          <ClipboardList size={40} className="mx-auto mb-3 opacity-30"/>
          <p className="mb-4">No field sheets yet</p>
          <Link href="/coach/drills/new" className="btn-primary text-sm">Create Your First Sheet</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {sheets.map(s => (
            <div key={s.id} className="card p-4 flex items-center gap-3">
              <Link href={`/coach/drills/${s.id}`} className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{s.title}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {s.category && <span className={`badge text-xs ${categoryColor(s.category)}`}>{s.category}</span>}
                  <span className="text-white/30 text-xs flex items-center gap-1"><Users size={11}/>{s.player_ids?.length ?? 0} players</span>
                  <span className="text-white/20 text-xs">· {(s.columns ?? []).length} columns</span>
                  <span className="text-white/20 text-xs">· updated {formatDate(s.updated_at)}</span>
                </div>
              </Link>
              <button onClick={() => duplicate(s)} className="text-white/20 hover:text-teal-400 transition-colors p-1.5" title="Duplicate">
                <Copy size={15}/>
              </button>
              <button onClick={() => remove(s.id)} className="text-white/20 hover:text-red-400 transition-colors p-1.5" title="Delete">
                <Trash2 size={15}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
