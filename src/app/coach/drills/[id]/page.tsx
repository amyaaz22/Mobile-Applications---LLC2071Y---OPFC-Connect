'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Plus, X, Download, Printer, UserPlus, Check } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

function slugify(label: string, existing: string[]) {
  let base = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'col'
  let key = base
  let i = 1
  while (existing.includes(key)) key = `${base}_${++i}`
  return key
}

export default function DrillSheetPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [sheet, setSheet] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [allPlayers, setAllPlayers] = useState<any[]>([])
  const [cellData, setCellData] = useState<Record<string, Record<string, string>>>({})
  const [saving, setSaving] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [newColumn, setNewColumn] = useState('')
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [addPlayerSearch, setAddPlayerSearch] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { fetchSheet() }, [params.id])

  async function fetchSheet() {
    const { data } = await supabase.from('field_sheets').select('*').eq('id', params.id as string).single()
    if (!data) { router.push('/coach/drills'); return }
    setSheet(data)
    setTitleDraft(data.title)
    setCellData(data.data ?? {})

    const [{ data: roster }, { data: all }] = await Promise.all([
      data.player_ids?.length
        ? supabase.from('players').select('id, full_name, player_code, category').in('id', data.player_ids)
        : Promise.resolve({ data: [] }),
      supabase.from('players').select('id, full_name, player_code, category').eq('is_active', true).order('full_name'),
    ])
    const byId: Record<string, any> = {}
    ;(roster ?? []).forEach((p: any) => { byId[p.id] = p })
    setPlayers((data.player_ids ?? []).map((id: string) => byId[id]).filter(Boolean))
    setAllPlayers(all ?? [])
  }

  const persist = useCallback((patch: any) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      const { error } = await supabase.from('field_sheets').update(patch).eq('id', params.id as string)
      setSaving(false)
      if (error) toast.error('Failed to save')
    }, 600)
  }, [params.id])

  function setCell(playerId: string, colKey: string, value: string) {
    setCellData(d => {
      const next = { ...d, [playerId]: { ...(d[playerId] ?? {}), [colKey]: value } }
      persist({ data: next })
      return next
    })
  }

  async function saveTitle() {
    setEditingTitle(false)
    if (!titleDraft.trim() || titleDraft === sheet.title) { setTitleDraft(sheet.title); return }
    await supabase.from('field_sheets').update({ title: titleDraft.trim() }).eq('id', params.id as string)
    setSheet((s: any) => ({ ...s, title: titleDraft.trim() }))
  }

  function addColumn() {
    const label = newColumn.trim()
    if (!label) return
    const cols = [...sheet.columns, { key: slugify(label, sheet.columns.map((c: any) => c.key)), label }]
    setSheet((s: any) => ({ ...s, columns: cols }))
    supabase.from('field_sheets').update({ columns: cols }).eq('id', params.id as string)
    setNewColumn('')
  }

  function removeColumn(key: string) {
    const cols = sheet.columns.filter((c: any) => c.key !== key)
    setSheet((s: any) => ({ ...s, columns: cols }))
    supabase.from('field_sheets').update({ columns: cols }).eq('id', params.id as string)
  }

  function addPlayer(playerId: string) {
    if (sheet.player_ids.includes(playerId)) return
    const ids = [...sheet.player_ids, playerId]
    setSheet((s: any) => ({ ...s, player_ids: ids }))
    supabase.from('field_sheets').update({ player_ids: ids }).eq('id', params.id as string)
    const p = allPlayers.find(p => p.id === playerId)
    if (p) setPlayers(pl => [...pl, p])
  }

  function removePlayer(playerId: string) {
    const ids = sheet.player_ids.filter((id: string) => id !== playerId)
    setSheet((s: any) => ({ ...s, player_ids: ids }))
    supabase.from('field_sheets').update({ player_ids: ids }).eq('id', params.id as string)
    setPlayers(pl => pl.filter(p => p.id !== playerId))
  }

  function exportExcel() {
    const rows = players.map(p => {
      const row: Record<string, any> = { 'Player': p.full_name, 'Code': p.player_code }
      sheet.columns.forEach((c: any) => { row[c.label] = cellData[p.id]?.[c.key] ?? '' })
      return row
    })
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch: 22 }, { wch: 10 }, ...sheet.columns.map(() => ({ wch: 16 }))]
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet')
    XLSX.writeFile(wb, `${sheet.title.replace(/[^\w\-]+/g, '_')}.xlsx`)
    toast.success('Exported to Excel')
  }

  async function exportPdf() {
    const { default: jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const marginX = 12
    const pageWidth = 297 - marginX * 2
    const nameW = 55
    const colW = (pageWidth - nameW) / Math.max(sheet.columns.length, 1)
    let y = 16

    pdf.setFontSize(16)
    pdf.setFont('helvetica', 'bold')
    pdf.text(sheet.title, marginX, y)
    y += 6
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(100)
    pdf.text(`${sheet.category ?? 'All players'} · ${players.length} players · ${new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}`, marginX, y)
    y += 8

    const rowH = 10
    function header() {
      pdf.setFillColor(230, 230, 230)
      pdf.rect(marginX, y, nameW, rowH, 'F')
      pdf.setTextColor(20)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'bold')
      pdf.text('Player', marginX + 2, y + rowH / 2 + 1.5)
      sheet.columns.forEach((c: any, i: number) => {
        const x = marginX + nameW + i * colW
        pdf.rect(x, y, colW, rowH, 'F')
        pdf.text(c.label, x + 2, y + rowH / 2 + 1.5, { maxWidth: colW - 4 })
      })
      y += rowH
    }
    header()

    pdf.setFont('helvetica', 'normal')
    players.forEach((p, i) => {
      if (y + rowH > 200) { pdf.addPage(); y = 16; header() }
      pdf.setDrawColor(180)
      pdf.rect(marginX, y, nameW, rowH)
      pdf.text(p.full_name, marginX + 2, y + rowH / 2 + 1.5, { maxWidth: nameW - 4 })
      sheet.columns.forEach((c: any, ci: number) => {
        const x = marginX + nameW + ci * colW
        pdf.rect(x, y, colW, rowH)
        const val = cellData[p.id]?.[c.key]
        if (val) pdf.text(String(val), x + 2, y + rowH / 2 + 1.5, { maxWidth: colW - 4 })
      })
      y += rowH
    })

    pdf.save(`${sheet.title.replace(/[^\w\-]+/g, '_')}.pdf`)
    toast.success('PDF ready — print it for pitch-side use')
  }

  if (!sheet) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  const availableToAdd = allPlayers.filter(p =>
    !sheet.player_ids.includes(p.id) &&
    p.full_name.toLowerCase().includes(addPlayerSearch.toLowerCase())
  )

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <Link href="/coach/drills" className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> Field Sheets
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <input autoFocus className="input text-lg font-bold max-w-md" value={titleDraft}
              onChange={e => setTitleDraft(e.target.value)} onBlur={saveTitle}
              onKeyDown={e => e.key === 'Enter' && saveTitle()}/>
          ) : (
            <h1 className="page-title cursor-text" onClick={() => setEditingTitle(true)}>{sheet.title}</h1>
          )}
          <p className="text-white/30 text-sm mt-1">
            {players.length} players · {sheet.columns.length} columns
            {saving && <span className="text-teal-400/60 ml-2">saving…</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14}/> Excel
          </button>
          <button onClick={exportPdf} className="btn-secondary flex items-center gap-2 text-sm">
            <Printer size={14}/> Print / PDF
          </button>
        </div>
      </div>

      <div className="card overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase sticky left-0 bg-[#112233]">Player</th>
                {sheet.columns.map((c: any) => (
                  <th key={c.key} className="text-left px-3 py-3 text-xs font-bold text-white/30 uppercase whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {c.label}
                      <button onClick={() => removeColumn(c.key)} className="text-white/15 hover:text-red-400 transition-colors">
                        <X size={11}/>
                      </button>
                    </div>
                  </th>
                ))}
                <th className="px-3 py-3 w-8"/>
              </tr>
            </thead>
            <tbody>
              {players.length === 0 ? (
                <tr><td colSpan={sheet.columns.length + 2} className="text-center py-10 text-white/30">No players on this sheet yet</td></tr>
              ) : players.map((p, i) => (
                <tr key={p.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                  <td className="px-4 py-2 sticky left-0 bg-[#112233]">
                    <p className="text-white text-sm font-medium whitespace-nowrap">{p.full_name}</p>
                    <p className="text-white/30 text-xs font-mono">{p.player_code}</p>
                  </td>
                  {sheet.columns.map((c: any) => (
                    <td key={c.key} className="px-2 py-1.5">
                      <input className="input py-1.5 px-2 text-sm min-w-[110px]"
                        value={cellData[p.id]?.[c.key] ?? ''}
                        onChange={e => setCell(p.id, c.key, e.target.value)}/>
                    </td>
                  ))}
                  <td className="px-2">
                    <button onClick={() => removePlayer(p.id)} className="text-white/15 hover:text-red-400 transition-colors p-1">
                      <X size={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-2 items-center">
          <input className="input flex-1 text-sm" placeholder="New column name…" value={newColumn}
            onChange={e => setNewColumn(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addColumn())}
            style={{ width: 200 }}/>
          <button onClick={addColumn} className="btn-secondary flex items-center gap-2 text-sm">
            <Plus size={14}/> Column
          </button>
        </div>
        <button onClick={() => setShowAddPlayer(v => !v)} className="btn-secondary flex items-center gap-2 text-sm">
          <UserPlus size={14}/> Add Player
        </button>
      </div>

      {showAddPlayer && (
        <div className="card p-4 mt-3 max-w-md">
          <input className="input mb-3 text-sm" placeholder="Search players…" value={addPlayerSearch} onChange={e => setAddPlayerSearch(e.target.value)}/>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {availableToAdd.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-3">No matching players</p>
            ) : availableToAdd.map(p => (
              <button key={p.id} onClick={() => addPlayer(p.id)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-white/5 text-left transition-colors">
                <span className="text-white text-sm">{p.full_name}</span>
                <Plus size={14} className="text-teal-400"/>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
