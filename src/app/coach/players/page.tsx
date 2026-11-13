'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Player } from '@/types/database'
import { categoryColor, getAge, formatDate } from '@/lib/utils'
import { Plus, Search, Filter, Users, Download, FileStack, Pencil, Archive, ArchiveRestore, X, QrCode, CheckCircle2, AlertTriangle } from 'lucide-react'
import PlayerCard from '@/components/cards/PlayerCard'
import { PassCardFront, PassCardBack } from '@/components/cards/PassCard'
import { toast } from 'react-hot-toast'
import * as XLSX from 'xlsx'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { useScopedCategories } from '@/hooks/useScopedCategories'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { useConfigList } from '@/hooks/useConfigList'
import { logAudit } from '@/lib/audit'

const FALLBACK_CATEGORIES = ['U9', 'U13', 'First Team']
const FALLBACK_POSITIONS = ['GK', 'DEF', 'MID', 'FWD']

// Shared by the full export and the "Export Selected" bulk action so both
// produce identical rows from the same player shape.
function playerToExportRow(p: any) {
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
}

const EXPORT_COLUMN_WIDTHS = [
  { wch: 24 }, { wch: 22 }, { wch: 16 }, { wch: 28 },
  { wch: 14 }, { wch: 30 }, { wch: 28 }, { wch: 22 },
  { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
]

export default function PlayersPage() {
  const supabase = createClient()
  const permitted = usePermissionGuard('players')
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')
  const [showArchived, setShowArchived] = useState(false)
  const [categories, setCategories] = useState<string[]>(FALLBACK_CATEGORIES)
  const { scopedCategories, visibleCategories } = useScopedCategories(categories)
  const [exporting, setExporting] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [renderPlayer, setRenderPlayer] = useState<any>(null)
  const [renderQrUrl, setRenderQrUrl] = useState('')
  const [qrCheckProgress, setQrCheckProgress] = useState<{ done: number; total: number } | null>(null)
  const [qrCheckResult, setQrCheckResult] = useState<{ total: number; bad: { name: string; code: string; reason: string }[] } | null>(null)
  const [clubInfo, setClubInfo] = useState<{ logo_url?: string; name?: string }>({})
  const positions = useConfigList('positions', FALLBACK_POSITIONS)

  // Mass/individual selection for bulk archive/unarchive, export, and field updates.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [showBulkUpdate, setShowBulkUpdate] = useState(false)
  const [bulkField, setBulkField] = useState<'category' | 'position'>('category')
  const [bulkValue, setBulkValue] = useState('')

  useEffect(() => {
    supabase.from('club_settings').select('value').eq('key', 'categories').single()
      .then(({ data }) => { if (data?.value) setCategories(data.value as string[]) })
    supabase.from('club_settings').select('value').eq('key', 'club_info').single()
      .then(({ data }) => { if (data?.value) setClubInfo(data.value as any) })
  }, [])

  async function exportToExcel() {
    setExporting(true)
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*, guardian:guardians(*)')
        .eq('is_active', true)
        .order('full_name')
      if (error || !data) { toast.error('Export failed'); return }

      const rows = data.map(playerToExportRow)
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = EXPORT_COLUMN_WIDTHS
      XLSX.utils.book_append_sheet(wb, ws, 'Players')
      XLSX.writeFile(wb, `OPFC_Players_${new Date().toISOString().split('T')[0]}.xlsx`)
      toast.success(`${rows.length} players exported`)
    } finally {
      setExporting(false)
    }
  }

  // Exports exactly the currently-selected rows, from already-loaded data —
  // no need to re-fetch since the table already has guardian/category/etc.
  function exportSelected() {
    const rows = players.filter(p => selected.has(p.id)).map(playerToExportRow)
    if (!rows.length) return
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = EXPORT_COLUMN_WIDTHS
    XLSX.utils.book_append_sheet(wb, ws, 'Players')
    XLSX.writeFile(wb, `OPFC_Players_Selected_${new Date().toISOString().split('T')[0]}.xlsx`)
    toast.success(`${rows.length} selected player(s) exported`)
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    const visibleIds = players.map(p => p.id)
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      visibleIds.forEach(id => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  // Archiving (is_active=false) is this app's only "delete" for players —
  // it hides them from the active roster but keeps every payment,
  // attendance, and stats record in case they rejoin later. Shared by both
  // directions (Archive Selected / Unarchive Selected) since they're the
  // same write with the opposite target value.
  async function bulkSetActive(active: boolean) {
    const ids = Array.from(selected)
    if (!ids.length) return
    const names = players.filter(p => ids.includes(p.id)).map(p => p.full_name)
    const verb = active ? 'Unarchive' : 'Archive'
    const confirmMsg = active
      ? `Unarchive ${ids.length} player(s)? They'll return to the active roster.`
      : `Archive ${ids.length} player(s)? They'll be hidden from the active roster, but their payments, attendance, and stats history are kept in case they rejoin later.`
    if (!confirm(confirmMsg)) return

    setBulkBusy(true)
    const { error } = await supabase.from('players').update({ is_active: active }).in('id', ids)
    setBulkBusy(false)
    if (error) { toast.error(`Bulk ${verb.toLowerCase()} failed`); return }

    logAudit(supabase, {
      action: active ? 'update' : 'delete', entity: 'player',
      summary: `Bulk-${verb.toLowerCase()}d ${ids.length} player(s): ${names.slice(0, 5).join(', ')}${names.length > 5 ? ', …' : ''}`,
      metadata: { player_ids: ids },
    })
    toast.success(`${ids.length} player(s) ${verb.toLowerCase()}d`)
    setSelected(new Set())
    fetchPlayers()
  }

  async function applyBulkUpdate() {
    const ids = Array.from(selected)
    if (!ids.length || !bulkValue) return

    setBulkBusy(true)
    const { error } = await supabase.from('players').update({ [bulkField]: bulkValue }).in('id', ids)
    setBulkBusy(false)
    if (error) { toast.error('Bulk update failed'); return }

    logAudit(supabase, {
      action: 'update', entity: 'player',
      summary: `Bulk-updated ${bulkField} to "${bulkValue}" for ${ids.length} player(s)`,
      metadata: { player_ids: ids, field: bulkField, value: bulkValue },
    })
    toast.success(`${bulkField === 'category' ? 'Category' : 'Position'} updated for ${ids.length} player(s)`)
    setSelected(new Set())
    setShowBulkUpdate(false)
    setBulkValue('')
    fetchPlayers()
  }

  // Cards per PDF file. A club-wide export can run into the hundreds of
  // pages (2 pages per player) in a single jsPDF/html2canvas document, which
  // gets slow to generate and heavy to open/print — split into batches of
  // this size instead, each its own downloaded PDF.
  const CARDS_PER_FILE = 50

  async function downloadAllCards() {
    const { data, error } = await supabase
      .from('players')
      .select('*, guardian:guardians(*)')
      .eq('is_active', true)
      .order('full_name')
    if (error || !data?.length) { toast.error('No players to export'); return }

    const [{ default: html2canvas }, { default: jsPDF }, { default: JSZip }] = await Promise.all([
      import('html2canvas'), import('jspdf'), import('jszip'),
    ])

    const players = data as any[]
    const batches: any[][] = []
    for (let i = 0; i < players.length; i += CARDS_PER_FILE) batches.push(players.slice(i, i + CARDS_PER_FILE))
    const multiFile = batches.length > 1

    // Chrome (and other Chromium browsers) block a page from triggering more
    // than one automatic file download in a row unless the user explicitly
    // allows it — each batch's pdf.save() happens well after the original
    // click, across several `await`s, so only the first of several batches
    // was ever actually reaching disk; the rest were silently blocked with
    // no error we could even catch. Bundling every batch's PDF into a single
    // .zip means exactly one download fires, which is never blocked.
    const zip = multiFile ? new JSZip() : null

    setBulkProgress({ done: 0, total: players.length })
    const dateStr = new Date().toISOString().split('T')[0]
    const badQrs: string[] = []

    for (let b = 0; b < batches.length; b++) {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })
      let first = true

      for (const p of batches[b]) {
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

          // Decode the QR straight out of the pixels that just went into the
          // PDF for this player, and confirm it still matches their id —
          // catches a stale off-screen render (this page re-renders
          // renderPlayer/renderQrUrl every iteration; if a capture ever ran
          // before React/the browser actually painted the new one, the QR on
          // a card would silently belong to the previous player) rather than
          // just confirming the QR library itself can round-trip a string.
          const ctx = c.getContext('2d')
          if (ctx) {
            const img = ctx.getImageData(0, 0, c.width, c.height)
            const decoded = jsQR(img.data, c.width, c.height)
            if (!decoded || decoded.data !== `opfc://player/${p.id}`) {
              badQrs.push(`${p.full_name} (${p.player_code})`)
            }
          }
        }

        setBulkProgress(prog => prog ? { done: prog.done + 1, total: prog.total } : prog)
      }

      const suffix = multiFile ? `_part${b + 1}of${batches.length}` : ''
      const filename = `OPFC_All_Player_Cards${suffix}_${dateStr}.pdf`
      if (zip) zip.file(filename, pdf.output('arraybuffer'))
      else pdf.save(filename)
    }

    if (zip) {
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `OPFC_All_Player_Cards_${dateStr}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }

    setRenderPlayer(null)
    toast.success(multiFile
      ? `${players.length} player cards downloaded as ${batches.length} PDFs in one .zip`
      : `${players.length} player cards downloaded`)
    if (badQrs.length) {
      toast.error(`${badQrs.length} QR code(s) didn't verify — check before printing: ${badQrs.slice(0, 5).join(', ')}${badQrs.length > 5 ? `, +${badQrs.length - 5} more` : ''}`, { duration: 10000 })
    }
    setBulkProgress(null)
  }

  // Standalone, fast integrity check — no PDF/DOM rendering, just generates
  // each active player's QR exactly as the bulk export would and decodes it
  // straight back, so you can confirm every card's QR is sound without
  // physically scanning each printed one. Also catches two different
  // players somehow ending up with the same payload (which a self-decode
  // alone can't).
  async function verifyQrCodes() {
    const { data, error } = await supabase
      .from('players')
      .select('id, full_name, player_code')
      .eq('is_active', true)
      .order('full_name')
    if (error || !data?.length) { toast.error('No players to verify'); return }

    setQrCheckResult(null)
    setQrCheckProgress({ done: 0, total: data.length })

    const bad: { name: string; code: string; reason: string }[] = []
    const seenPayloads = new Map<string, string>() // payload -> player_code

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    for (const p of data as any[]) {
      const expected = `opfc://player/${p.id}`
      const dataUrl = await QRCode.toDataURL(expected, {
        color: { dark: '#4EC6C6', light: '#0D1B2A' }, width: 200, margin: 2,
      })
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = dataUrl
      })
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)
      const decoded = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height)

      if (!decoded) {
        bad.push({ name: p.full_name, code: p.player_code, reason: 'Could not be decoded at all' })
      } else if (decoded.data !== expected) {
        bad.push({ name: p.full_name, code: p.player_code, reason: `Decoded to the wrong value` })
      } else if (seenPayloads.has(decoded.data)) {
        bad.push({ name: p.full_name, code: p.player_code, reason: `Same QR as ${seenPayloads.get(decoded.data)}` })
      } else {
        seenPayloads.set(decoded.data, p.player_code)
      }

      setQrCheckProgress(prog => prog ? { done: prog.done + 1, total: prog.total } : prog)
    }

    setQrCheckProgress(null)
    setQrCheckResult({ total: data.length, bad })
    if (bad.length) toast.error(`${bad.length} of ${data.length} QR codes need attention`)
    else toast.success(`All ${data.length} QR codes verified — each decodes correctly and uniquely`)
  }

  async function fetchPlayers() {
    setLoading(true)
    let query = supabase
      .from('players')
      .select(`*, guardian:guardians(*), stats:player_stats(*)`)
      .eq('is_active', !showArchived)
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

  useEffect(() => { fetchPlayers() }, [search, category, scopedCategories, showArchived])

  function toggleShowArchived() {
    setSelected(new Set())
    setShowArchived(a => !a)
  }

  if (!permitted) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="text-white/30 text-sm mt-1">{players.length} {showArchived ? 'archived' : 'active'} players</p>
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
          <button onClick={verifyQrCodes} disabled={!!qrCheckProgress} title="Decodes every active player's QR without printing anything, confirming each one is correct and no two players share a code"
            className="btn-secondary flex items-center gap-2 self-start text-sm">
            <QrCode size={14}/> {qrCheckProgress ? `${qrCheckProgress.done}/${qrCheckProgress.total}…` : 'Verify QR Codes'}
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
        <button onClick={toggleShowArchived}
          className={`btn-secondary flex items-center gap-2 text-sm ${showArchived ? 'border-teal-400/30 text-teal-400' : ''}`}>
          {showArchived ? <><Users size={14}/> Active</> : <><Archive size={14}/> Archived</>}
        </button>
        <button onClick={() => setViewMode(v => v === 'list' ? 'cards' : 'list')}
          className="btn-secondary flex items-center gap-2 text-sm">
          {viewMode === 'list' ? '🃏 Cards' : '≡ List'}
        </button>
      </div>

      {/* Bulk action bar — appears once at least one player is selected */}
      {selected.size > 0 && (
        <div className="card p-3 mb-6 flex flex-wrap items-center gap-3 border border-teal-400/20 bg-teal-400/5">
          <span className="text-white text-sm font-semibold">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-white/40 text-xs hover:text-white flex items-center gap-1">
            <X size={12}/> Clear
          </button>
          <div className="flex-1"/>
          <button onClick={exportSelected} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14}/> Export Selected
          </button>
          {!showArchived && (
            <button onClick={() => setShowBulkUpdate(true)} className="btn-secondary flex items-center gap-2 text-sm">
              <Pencil size={14}/> Bulk Update
            </button>
          )}
          <button onClick={() => bulkSetActive(showArchived)} disabled={bulkBusy}
            className={`flex items-center gap-2 text-sm ${showArchived ? 'btn-secondary' : 'btn-danger'}`}>
            {showArchived ? <ArchiveRestore size={14}/> : <Archive size={14}/>}
            {bulkBusy ? 'Working…' : showArchived ? 'Unarchive Selected' : 'Archive Selected'}
          </button>
        </div>
      )}

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
              <p>{showArchived ? 'No archived players' : 'No players found'}</p>
              {!showArchived && <Link href="/coach/players/new" className="btn-primary text-sm">Add First Player</Link>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={players.length > 0 && players.every(p => selected.has(p.id))}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 accent-teal-400 cursor-pointer"/>
                    </th>
                    {['Player', 'Category', 'Position', 'OVR', 'Age', 'Guardian', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/2'} ${selected.has(p.id) ? 'bg-teal-400/5' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 accent-teal-400 cursor-pointer"/>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0">
                            {p.photo_url
                              ? <img src={p.photo_url} className="w-full h-full rounded-full object-cover" alt=""/>
                              : <span className="text-teal-400 font-bold text-sm">{p.full_name[0]}</span>
                            }
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm flex items-center gap-1.5">
                              {p.full_name}
                              {p.enrollment_status === 'trial' && <span className="badge bg-amber-500/15 text-amber-300 border-amber-500/25 text-[10px] py-0">Trial</span>}
                            </p>
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
              guardianPhone={(Array.isArray(renderPlayer.guardian) ? renderPlayer.guardian[0] : renderPlayer.guardian)?.phone_primary}
              guardianPhone2={(Array.isArray(renderPlayer.guardian) ? renderPlayer.guardian[0] : renderPlayer.guardian)?.phone_secondary}/></div>
            <div id="bulk-card-back"><PassCardBack player={renderPlayer} qrUrl={renderQrUrl}/></div>
          </>
        )}
      </div>

      {/* Bulk field update modal */}
      {showBulkUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card p-6 w-full max-w-sm">
            <h2 className="text-white font-bold text-lg mb-4">Bulk Update {selected.size} Player(s)</h2>
            <label className="label">Field</label>
            <select className="input mb-3" value={bulkField}
              onChange={e => { setBulkField(e.target.value as 'category' | 'position'); setBulkValue('') }}>
              <option value="category">Category</option>
              <option value="position">Position</option>
            </select>
            <label className="label">New value</label>
            <select className="input mb-5" value={bulkValue} onChange={e => setBulkValue(e.target.value)}>
              <option value="">Select…</option>
              {(bulkField === 'category' ? categories : positions).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button onClick={applyBulkUpdate} disabled={!bulkValue || bulkBusy} className="btn-primary flex-1 text-sm">
                {bulkBusy ? 'Updating…' : 'Apply'}
              </button>
              <button onClick={() => { setShowBulkUpdate(false); setBulkValue('') }} className="btn-secondary flex-1 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* QR verification progress */}
      {qrCheckProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="card p-6 w-full max-w-sm text-center">
            <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full mx-auto mb-4"/>
            <p className="text-white font-semibold text-sm">Verifying QR codes…</p>
            <p className="text-white/40 text-xs mt-1">{qrCheckProgress.done} of {qrCheckProgress.total}</p>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-teal-400 rounded-full transition-all" style={{ width: `${(qrCheckProgress.done / qrCheckProgress.total) * 100}%` }}/>
            </div>
          </div>
        </div>
      )}

      {/* QR verification results */}
      {qrCheckResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setQrCheckResult(null)}>
          <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2">
                {qrCheckResult.bad.length === 0
                  ? <CheckCircle2 size={20} className="text-green-400"/>
                  : <AlertTriangle size={20} className="text-amber-400"/>}
                <p className="text-white font-semibold text-sm">
                  {qrCheckResult.bad.length === 0 ? 'All QR codes verified' : `${qrCheckResult.bad.length} of ${qrCheckResult.total} need attention`}
                </p>
              </div>
              <button onClick={() => setQrCheckResult(null)} className="text-white/30 hover:text-white"><X size={16}/></button>
            </div>
            {qrCheckResult.bad.length === 0 ? (
              <p className="text-white/40 text-xs">Every active player's QR decodes to the correct, unique value — safe to print.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {qrCheckResult.bad.map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-white text-sm">{b.name}</p>
                      <p className="text-white/30 text-xs font-mono">{b.code}</p>
                    </div>
                    <span className="text-amber-400 text-xs text-right">{b.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
