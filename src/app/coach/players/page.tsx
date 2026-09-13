'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Player } from '@/types/database'
import { categoryColor, getAge, formatDate } from '@/lib/utils'
import { Plus, Search, Filter, Users, Download, FileStack } from 'lucide-react'
import PlayerCard from '@/components/cards/PlayerCard'
import { PassCardFront, PassCardBack } from '@/components/cards/PassCard'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'

const FALLBACK_CATEGORIES = ['U9', 'U13', 'First Team']

export default function PlayersPage() {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES)
  const [scopedCategories, setScopedCategories] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [renderPlayer, setRenderPlayer] = useState<any>(null)
  const [renderQrUrl, setRenderQrUrl] = useState('')
  const [clubInfo, setClubInfo] = useState<{ logo_url?: string; name?: string }>({})

  useEffect(() => {
    supabase.from('club_settings').select('value').eq('key', 'categories').single()
      .then(({ data }) => { if (data?.value) setCategories(data.value as string[]) })
    supabase.from('club_settings').select('value').eq('key', 'club_info').single()
      .then(({ data }) => { if (data?.value) setClubInfo(data.value as any) })
    // Soft UI scoping: if this coach is limited to specific categories, only
    // offer those here. Not an RLS boundary — see CLAUDE.md.
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('assigned_categories').eq('id', user.id).single()
        .then(({ data }) => { if (data?.assigned_categories?.length) setScopedCategories(data.assigned_categories) })
    })
  }, [])

  const visibleCategories = scopedCategories.length ? scopedCategories : categories

  async function exportToExcel() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*, guardian:guardians(*)')
        .eq('is_active', true)
        .order('full_name')
      if (error || !data) { toast.error('Export failed'); return }

      const rows = data.map((p: any) => {
        const g = Array.isArray(p.guardian) ? p.guardian[0] : p.guardian
        const [y, m, d] = String(p.date_of_birth).split('-')
        return {
          'Full Name': p.full_name,
          'Date of Birth (DD/MM/YYYY)': d && m && y ? `${d}/${m}/${y}` : '',
          'Category': p.category,
          'Position (GK / DEF / MID / FWD)': p.position,
          'Nationality': p.nationality ?? '',
          'School / Grade': p.school ?? '',
          'Address': p.address ?? '',
          'Medical Notes': p.medical_notes ?? '',
          'Guardian Full Name': g?.full_name ?? '',
          'Guardian Relationship': g?.relationship ?? '',
          'Guardian Phone (WhatsApp)': g?.phone_primary ?? '',
          'Guardian Email': g?.email ?? '',
        }
      })

      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [
        { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 28 },
        { wch: 14 }, { wch: 30 }, { wch: 28 }, { wch: 22 },
        { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
      ]
      XLSX.utils.book_append_sheet(wb, ws, 'Players')
      XLSX.writeFile(wb, `OPFC_Players_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success(`${rows.length} players exported`)
    } finally {
      setExporting(false)
    }
  }

  async function downloadAllCards() {
    const { data, error } = await supabase
      .from('players')
      .select('*, guardian:guardians(*)')
      .eq('is_active', true)
      .order('full_name')
    if (error || !data?.length) { toast.error('No players to export'); return }

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'), import('jspdf'),
    ])
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })

    setBulkProgress({ done: 0, total: data.length })
    let first = true

    for (const p of data as any[]) {
      const guardian = Array.isArray(p.guardian) ? p.guardian[0] : p.guardian
      const qrUrl = await QRCode.toDataURL(`opfc://player/${p.id}`, {
        color: { dark: '#4EC6C6', light: '#0D1B2A' }, width: 200, margin: 2,
      })
      setRenderPlayer(p)
      setRenderQrUrl(qrUrl)
      // Wait two frames so React has committed and the browser has painted
      // the off-screen card before html2canvas captures it.
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))

      const frontEl = document.getElementById('bulk-card-front')
      const backEl = document.getElementById('bulk-card-back')
      if (frontEl) {
        const c = await html2canvas(frontEl, { scale: 2, backgroundColor: '#0D1B2A', useCORS: true })
        if (!first) pdf.addPage()
        pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54)
        first = false
      }
      if (backEl) {
        const c = await html2canvas(backEl, { scale: 2, backgroundColor: '#091520', useCORS: true })
        pdf.addPage()
        pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54)
      }

      setBulkProgress(prog => prog ? { done: prog.done + 1, total: prog.total } : prog)
    }

    setRenderPlayer(null)
    pdf.save(`OPFC_All_Player_Cards_${new Date().toISOString().split('T')[0]}.pdf`)
    toast.success(`${data.length} player cards downloaded`)
    setBulkProgress(null)
  }

  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true)
      let query = supabase
        .from('players')
        .select(`*, guardian:guardians(*), stats:player_stats(*)`)
        .eq('is_active', true)
        .order('full_name')

      if (category !== 'All') query = query.eq('category', category)
      else if (scopedCategories.length) query = query.in('category', scopedCategories)
      if (search) query = query.ilike('full_name', `%${search}%`)

      const { data } = await query
      setPlayers(data?.map(p => ({
        ...p,
        stats: p.stats?.sort((a: any, b: any) => b.assessed_month.localeCompare(a.assessed_month))[0] ?? null
      })) ?? [])
      setLoading(false)
    }
    fetchPlayers()
  }, [search, category, scopedCategories])

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="text-white/30 text-sm mt-1">{players.length} active players</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportToExcel} disabled={exporting}
            className="btn-secondary flex items-center gap-2 self-start text-sm">
            <Download size={14}/> {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button onClick={downloadAllCards} disabled={!!bulkProgress}
            className="btn-secondary flex items-center gap-2 self-start text-sm">
            <FileStack size={14}/> {bulkProgress ? `${bulkProgress.done}/${bulkProgress.total}…` : 'Download All Cards'}
          </button>
          <Link href="/coach/players/import" className="btn-secondary flex items-center gap-2 self-start text-sm">
            <span>↑</span> Import
          </Link>
          <Link href="/coach/players/new" className="btn-primary flex items-center gap-2 self-start">
            <Plus size={16}/> Add Player
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
          <input
            type="text"
            className="input pl-9"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {['All', ...visibleCategories].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border
                ${category === cat
                  ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}>
              {cat}
            </button>
          ))}
        </div>
        <button onClick={() => setViewMode(v => v === 'list' ? 'cards' : 'list')}
          className="btn-secondary flex items-center gap-2 text-sm">
          {viewMode === 'list' ? '🃏 Cards' : '≡ List'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-white/30">
          <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full mr-3"/>
          Loading players…
        </div>
      )}

      {/* Card view */}
      {!loading && viewMode === 'cards' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {players.map(p => (
            <Link key={p.id} href={`/coach/players/${p.id}`} className="hover:scale-105 transition-transform">
              <PlayerCard player={p} stats={p.stats} compact/>
            </Link>
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && viewMode === 'list' && (
        <div className="card overflow-hidden">
          {players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <Users size={40} className="opacity-30"/>
              <p>No players found</p>
              <Link href="/coach/players/new" className="btn-primary text-sm">Add First Player</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Player', 'Category', 'Position', 'OVR', 'Age', 'Guardian', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0">
                            {p.photo_url
                              ? <img src={p.photo_url} className="w-full h-full rounded-full object-cover" alt=""/>
                              : <span className="text-teal-400 font-bold text-sm">{p.full_name[0]}</span>
                            }
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{p.full_name}</p>
                            <p className="text-white/30 text-xs font-mono">{p.player_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${categoryColor(p.category)}`}>{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-sm">{p.position}</td>
                      <td className="px-4 py-3">
                        <span className={`text-lg font-black font-condensed ${p.stats?.ovr >= 80 ? 'text-teal-400' : 'text-white'}`}>
                          {p.stats?.ovr ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-sm">{getAge(p.date_of_birth)}</td>
                      <td className="px-4 py-3 text-white/60 text-sm">{p.guardian?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/coach/players/${p.id}`} className="text-teal-400 text-sm hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Off-screen render target for bulk card generation — in the DOM
          (not display:none) so html2canvas can actually capture it. */}
      <div style={{ position: 'fixed', top: 0, left: -9999, pointerEvents: 'none' }}>
        {renderPlayer && (
          <>
            <div id="bulk-card-front"><PassCardFront player={renderPlayer} logoUrl={clubInfo.logo_url} clubName={clubInfo.name}
              guardianPhone={(Array.isArray(renderPlayer.guardian) ? renderPlayer.guardian[0] : renderPlayer.guardian)?.phone_primary}/></div>
            <div id="bulk-card-back"><PassCardBack player={renderPlayer} qrUrl={renderQrUrl}
              guardianPhone={(Array.isArray(renderPlayer.guardian) ? renderPlayer.guardian[0] : renderPlayer.guardian)?.phone_primary}/></div>
          </>
        )}
      </div>

      {/* Bulk download progress */}
      {bulkProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full mx-auto mb-4"/>
            <p className="text-white font-semibold text-sm">Generating player cards…</p>
            <p className="text-white/40 text-xs mt-1">{bulkProgress.done} of {bulkProgress.total} — please keep this tab open</p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${(bulkProgress.done / bulkProgress.total) * 100}%` }}/>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
