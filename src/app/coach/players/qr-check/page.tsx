'use client'
import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck, ImagePlus, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { playerQrDataUrl, playerQrPayload, playerIdFromQr } from '@/lib/cardQr'

// Bulk QR checker — so nobody has to scan cards one at a time.
//  1. "Check every card's QR": regenerates the exact QR each player's card
//     carries (same helper the card export uses), decodes it with the SAME
//     library the live attendance scanner uses, and confirms it reads back as
//     that player. Also flags missing/duplicate member IDs.
//  2. "Check printed cards": drop in photos/scans of physical cards; each is
//     decoded and matched to a player, and any active player with no card
//     seen is listed.

type P = { id: string; full_name: string; player_code: string | null; is_active: boolean }
type Row = { label: string; status: 'ok' | 'warn' | 'fail'; detail: string }

async function fetchAllPlayers(): Promise<P[]> {
  const supabase = createClient()
  const out: P[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('players').select('id, full_name, player_code, is_active')
      .order('full_name').range(from, from + 999)
    if (error) throw error
    out.push(...((data ?? []) as P[]))
    if (!data || data.length < 1000) break
  }
  return out
}

async function dataUrlToFile(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob()
  return new File([blob], name, { type: blob.type || 'image/png' })
}

const tick = () => new Promise(r => setTimeout(r, 0))

export default function QrCheckPage() {
  const permitted = usePermissionGuard('players')
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<null | 'generated' | 'printed'>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<string>('')
  const [error, setError] = useState<string>('')

  async function makeScanner() {
    const { Html5Qrcode } = await import('html5-qrcode')
    return new Html5Qrcode('qr-check-host', false)
  }

  async function checkGenerated() {
    setBusy('generated'); setRows([]); setSummary(''); setError('')
    try {
      const players = (await fetchAllPlayers()).filter(p => p.is_active)
      const scanner = await makeScanner()
      setProgress({ done: 0, total: players.length })

      const problems: Row[] = []
      const codeCount = new Map<string, number>()
      players.forEach(p => { if (p.player_code) codeCount.set(p.player_code, (codeCount.get(p.player_code) ?? 0) + 1) })

      let ok = 0
      for (let i = 0; i < players.length; i++) {
        const p = players[i]
        const label = `${p.full_name}${p.player_code ? ` (${p.player_code})` : ''}`
        try {
          const file = await dataUrlToFile(await playerQrDataUrl(p.id), `${p.id}.png`)
          const text = await scanner.scanFile(file, false)
          if (text !== playerQrPayload(p.id)) problems.push({ label, status: 'fail', detail: 'QR decoded to a different value than expected' })
          else if (!p.player_code) problems.push({ label, status: 'warn', detail: 'QR is fine, but this player has no member ID printed on the card' })
          else if ((codeCount.get(p.player_code) ?? 0) > 1) problems.push({ label, status: 'warn', detail: `QR is fine, but member ID ${p.player_code} is shared with another player` })
          else ok++
        } catch {
          problems.push({ label, status: 'fail', detail: 'QR could not be read back' })
        }
        if (i % 10 === 9) { setProgress({ done: i + 1, total: players.length }); await tick() }
      }
      setProgress({ done: players.length, total: players.length })
      setRows(problems)
      setSummary(`${ok} of ${players.length} active players: QR reads back correctly with a unique member ID.` +
        (problems.length ? ` ${problems.length} need attention.` : ' Nothing to fix.'))
    } catch (e: any) {
      setError(e?.message ?? 'Check failed')
    } finally { setBusy(null) }
  }

  async function checkPrinted(files: FileList | null) {
    if (!files?.length) return
    setBusy('printed'); setRows([]); setSummary(''); setError('')
    try {
      const players = await fetchAllPlayers()
      const byId = new Map(players.map(p => [p.id, p]))
      const scanner = await makeScanner()
      setProgress({ done: 0, total: files.length })

      const out: Row[] = []
      const seen = new Map<string, string>()
      let ok = 0
      for (let i = 0; i < files.length; i++) {
        const f = files[i]
        try {
          const text = await scanner.scanFile(f, false)
          const id = playerIdFromQr(text)
          const p = byId.get(id)
          if (!p) out.push({ label: f.name, status: 'fail', detail: 'QR read, but it does not belong to any player in this club' })
          else if (!p.is_active) out.push({ label: f.name, status: 'warn', detail: `${p.full_name} is archived — this card will be refused at check-in` })
          else if (seen.has(id)) out.push({ label: f.name, status: 'warn', detail: `Duplicate: ${p.full_name} was already seen in ${seen.get(id)}` })
          else { seen.set(id, f.name); ok++ }
        } catch {
          out.push({ label: f.name, status: 'fail', detail: 'No readable QR found in this image' })
        }
        if (i % 5 === 4) { setProgress({ done: i + 1, total: files.length }); await tick() }
      }
      setProgress({ done: files.length, total: files.length })

      const active = players.filter(p => p.is_active)
      const missing = active.filter(p => !seen.has(p.id))
      out.push(...missing.slice(0, 200).map<Row>(p => ({
        label: `${p.full_name}${p.player_code ? ` (${p.player_code})` : ''}`, status: 'warn', detail: 'No card image supplied for this active player',
      })))
      setRows(out)
      setSummary(`${ok} card image(s) matched an active player. ${missing.length} active player(s) not covered.`)
    } catch (e: any) {
      setError(e?.message ?? 'Check failed')
    } finally { setBusy(null); if (fileRef.current) fileRef.current.value = '' }
  }

  if (!permitted) return null

  const icon = (s: Row['status']) => s === 'ok' ? <CheckCircle2 size={15} className="text-emerald-400 shrink-0"/>
    : s === 'warn' ? <AlertTriangle size={15} className="text-amber-400 shrink-0"/> : <XCircle size={15} className="text-red-400 shrink-0"/>

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link href="/coach/players" className="inline-flex items-center gap-1.5 text-white/40 hover:text-white text-sm mb-4"><ArrowLeft size={14}/> Players</Link>
      <h1 className="page-title">Verify QR Codes</h1>
      <p className="text-white/40 text-sm mt-1 mb-6">Check every member card in one go instead of scanning them one by one.</p>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <h2 className="text-white font-bold flex items-center gap-2"><ShieldCheck size={16} className="text-[#4EC6C6]"/> Check every card&apos;s QR</h2>
          <p className="text-white/40 text-xs mt-1 mb-4">Regenerates each active player&apos;s card QR, reads it back with the attendance scanner&apos;s own decoder, and flags missing or duplicate member IDs. Run it before you print.</p>
          <button onClick={checkGenerated} disabled={!!busy} className="btn-primary text-sm flex items-center gap-2">
            {busy === 'generated' ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} Run check
          </button>
        </div>
        <div className="card p-5">
          <h2 className="text-white font-bold flex items-center gap-2"><ImagePlus size={16} className="text-[#4EC6C6]"/> Check printed cards</h2>
          <p className="text-white/40 text-xs mt-1 mb-4">Select photos or scans of the physical cards (PNG/JPG). Each is decoded and matched to a player; active players with no card image are listed.</p>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={e => checkPrinted(e.target.files)}/>
          <button onClick={() => fileRef.current?.click()} disabled={!!busy} className="btn-secondary text-sm flex items-center gap-2">
            {busy === 'printed' ? <Loader2 size={14} className="animate-spin"/> : <ImagePlus size={14}/>} Choose images
          </button>
        </div>
      </div>

      {busy && <p className="text-white/50 text-sm mb-4">Checking… {progress.done}/{progress.total}</p>}
      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
      {summary && <p className="text-white text-sm font-semibold mb-3">{summary}</p>}

      {rows.length > 0 && (
        <div className="card divide-y divide-white/5">
          {rows.map((r, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-2.5">
              {icon(r.status)}
              <div className="min-w-0">
                <div className="text-white text-sm truncate">{r.label}</div>
                <div className="text-white/40 text-xs">{r.detail}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* html5-qrcode needs a host element to decode image files into */}
      <div id="qr-check-host" className="hidden"/>
    </div>
  )
}
