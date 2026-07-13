'use client'
import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { Download, Upload, CheckCircle, XCircle, ArrowLeft, FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'
import * as XLSX from 'xlsx'

interface ImportRow {
  row: number
  full_name: string
  date_of_birth: string
  category: string
  position: string
  nationality: string
  school: string
  address: string
  medical_notes: string
  guardian_name: string
  guardian_relationship: string
  guardian_phone: string
  guardian_email: string
  status?: 'pending' | 'success' | 'error'
  error?: string
}

const SAMPLE_DATA = [
  {
    'Full Name': 'Yannick Ferreira',
    'Date of Birth (DD/MM/YYYY)': '14/03/2006',
    'Category (U9 / U13 / First Team)': 'First Team',
    'Position (GK / DEF / MID / FWD)': 'FWD',
    'Nationality': 'Mauritian',
    'School / Grade': 'Grade 11 — Royal College Port Louis',
    'Address': 'Avenue des Cocotiers, Pailles',
    'Medical Notes': '',
    'Guardian Full Name': 'Marc Ferreira',
    'Guardian Relationship': 'Father',
    'Guardian Phone (WhatsApp)': '57123456',
    'Guardian Email': 'marc@email.mu',
  },
  {
    'Full Name': 'Rayan Boodhoo',
    'Date of Birth (DD/MM/YYYY)': '22/07/2011',
    'Category (U9 / U13 / First Team)': 'U13',
    'Position (GK / DEF / MID / FWD)': 'MID',
    'Nationality': 'Mauritian',
    'School / Grade': 'Grade 6 — Raffray Government School',
    'Address': 'Rue de la Paix, Pailles',
    'Medical Notes': 'Mild asthma — has inhaler',
    'Guardian Full Name': 'Sarah Boodhoo',
    'Guardian Relationship': 'Mother',
    'Guardian Phone (WhatsApp)': '58234567',
    'Guardian Email': 'sarah@email.mu',
  },
  {
    'Full Name': 'Kian Bhookhun',
    'Date of Birth (DD/MM/YYYY)': '11/09/2016',
    'Category (U9 / U13 / First Team)': 'U9',
    'Position (GK / DEF / MID / FWD)': 'GK',
    'Nationality': 'Mauritian',
    'School / Grade': 'Grade 1 — Pailles Primary',
    'Address': 'Résidence Raffray, Pailles',
    'Medical Notes': '',
    'Guardian Full Name': 'Priya Bhookhun',
    'Guardian Relationship': 'Mother',
    'Guardian Phone (WhatsApp)': '56456789',
    'Guardian Email': '',
  },
]

function downloadSample() {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(SAMPLE_DATA)

  // Column widths
  ws['!cols'] = [
    { wch: 24 }, { wch: 22 }, { wch: 28 }, { wch: 28 },
    { wch: 14 }, { wch: 30 }, { wch: 28 }, { wch: 22 },
    { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 24 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Players')

  // Add instructions sheet
  const instructions = [
    ['OPFC Connect — Player Import Template'],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Fill in the Players sheet with your player data'],
    ['2. Do NOT change column headers'],
    ['3. Date of Birth must be in DD/MM/YYYY format (e.g. 14/03/2006)'],
    ['4. Category must be exactly: U9, U13, or First Team'],
    ['5. Position must be exactly: GK, DEF, MID, or FWD'],
    ['6. Guardian Phone should be the WhatsApp number'],
    ['7. Guardian Email is optional but recommended for player card delivery'],
    ['8. Medical Notes is optional — leave blank if none'],
    ['9. You can delete the 3 sample rows before filling in your data'],
    ['10. Save as .xlsx and upload in the Import Players page'],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(instructions)
  ws2['!cols'] = [{ wch: 70 }]
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions')

  XLSX.writeFile(wb, 'OPFC_Player_Import_Template.xlsx')
}

function parseDate(raw: string): string | null {
  if (!raw) return null
  // Try DD/MM/YYYY
  const parts = String(raw).trim().split('/')
  if (parts.length === 3) {
    const [d, m, y] = parts
    const date = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`)
    if (!isNaN(date.getTime())) return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  // Try Excel serial date
  if (!isNaN(Number(raw))) {
    const date = new Date((Number(raw) - 25569) * 86400 * 1000)
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]
    }
  }
  return null
}

function validateRow(row: any, i: number): ImportRow | null {
  const name = String(row['Full Name'] ?? '').trim()
  if (!name) return null // skip empty rows

  const dob = parseDate(row['Date of Birth (DD/MM/YYYY)'])
  const category = String(row['Category (U9 / U13 / First Team)'] ?? '').trim()
  const position = String(row['Position (GK / DEF / MID / FWD)'] ?? '').trim()

  const errors: string[] = []
  if (!dob) errors.push('Invalid date of birth')
  if (!['U9','U13','First Team'].includes(category)) errors.push('Invalid category')
  if (!['GK','DEF','MID','FWD'].includes(position)) errors.push('Invalid position')
  if (!String(row['Guardian Full Name'] ?? '').trim()) errors.push('Guardian name required')
  if (!String(row['Guardian Phone (WhatsApp)'] ?? '').trim()) errors.push('Guardian phone required')

  return {
    row: i + 2,
    full_name: name,
    date_of_birth: dob ?? '',
    category,
    position,
    nationality: String(row['Nationality'] ?? 'Mauritian').trim() || 'Mauritian',
    school: String(row['School / Grade'] ?? '').trim(),
    address: String(row['Address'] ?? '').trim(),
    medical_notes: String(row['Medical Notes'] ?? '').trim(),
    guardian_name: String(row['Guardian Full Name'] ?? '').trim(),
    guardian_relationship: String(row['Guardian Relationship'] ?? 'Parent').trim() || 'Parent',
    guardian_phone: String(row['Guardian Phone (WhatsApp)'] ?? '').trim(),
    guardian_email: String(row['Guardian Email'] ?? '').trim(),
    status: errors.length ? 'error' : 'pending',
    error: errors.join(', '),
  }
}

export default function ImportPlayersPage() {
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [results, setResults] = useState<{ success: number; failed: number }>({ success: 0, failed: 0 })

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result
      const wb = XLSX.read(data, { type: 'binary' })
      const ws = wb.Sheets['Players'] ?? wb.Sheets[wb.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(ws)
      const parsed = (json as any[])
        .map((row: any, i: number) => validateRow(row, i))
        .filter(Boolean) as ImportRow[]
      setRows(parsed)
      setDone(false)
    }
    reader.readAsBinaryString(file)
  }

  async function runImport() {
    setImporting(true)
    let success = 0
    let failed = 0

    const updated = [...rows]

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (r.status === 'error') { failed++; continue }

      try {
        // Insert player
        const { data: player, error: pe } = await supabase
          .from('players')
          .insert({
            full_name: r.full_name,
            date_of_birth: r.date_of_birth,
            category: r.category,
            position: r.position,
            nationality: r.nationality,
            school: r.school || null,
            address: r.address || null,
            medical_notes: r.medical_notes || null,
            is_active: true,
          })
          .select()
          .single()

        if (pe || !player) {
          updated[i] = { ...r, status: 'error', error: pe?.message ?? 'Insert failed' }
          failed++
          continue
        }

        // Insert guardian
        const { error: ge } = await supabase.from('guardians').insert({
          player_id: player.id,
          full_name: r.guardian_name,
          relationship: r.guardian_relationship,
          phone_primary: r.guardian_phone,
          email: r.guardian_email || null,
        })

        if (ge) {
          updated[i] = { ...r, status: 'error', error: 'Guardian insert failed: ' + ge.message }
          failed++
          continue
        }

        updated[i] = { ...r, status: 'success' }
        success++
      } catch (err: any) {
        updated[i] = { ...r, status: 'error', error: err.message }
        failed++
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 100))
    }

    setRows(updated)
    setResults({ success, failed })
    setDone(true)
    setImporting(false)

    if (success > 0) toast.success(`${success} players imported!`)
    if (failed > 0) toast.error(`${failed} failed — check the list`)
  }

  const validRows = rows.filter(r => r.status !== 'error')
  const errorRows = rows.filter(r => r.status === 'error')

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <Link href="/coach/players"
        className="inline-flex items-center gap-2 text-white/40 hover:text-white text-sm mb-6 transition-colors">
        <ArrowLeft size={16}/> Players
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="page-title">Import Players</h1>
          <p className="text-white/30 text-sm mt-1">Upload an Excel file to register multiple players at once</p>
        </div>
        <button onClick={downloadSample}
          className="btn-secondary flex items-center gap-2">
          <Download size={16}/> Download Template
        </button>
      </div>

      {/* How it works */}
      {rows.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {[
            { step: '1', title: 'Download Template', desc: 'Click "Download Template" to get the Excel file with the correct column headers and 3 sample rows.' },
            { step: '2', title: 'Fill in Your Players', desc: 'Add all your players to the sheet. Delete the sample rows. Save as .xlsx.' },
            { step: '3', title: 'Upload & Import', desc: 'Upload the filled file here. Review the preview, then click Import to create all players at once.' },
          ].map(({ step, title, desc }) => (
            <div key={step} className="card p-5">
              <div className="w-8 h-8 rounded-full bg-teal-400/20 border border-teal-400/30 flex items-center justify-center mb-3">
                <span className="text-teal-400 font-bold text-sm">{step}</span>
              </div>
              <h3 className="text-white font-bold text-sm mb-1">{title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      {rows.length === 0 && (
        <div
          className="border-2 border-dashed border-white/10 rounded-2xl p-12 text-center cursor-pointer hover:border-teal-400/30 hover:bg-teal-400/3 transition-all"
          onClick={() => fileRef.current?.click()}>
          <FileSpreadsheet size={48} className="mx-auto mb-4 text-teal-400/40"/>
          <p className="text-white font-semibold mb-1">Click to upload your Excel file</p>
          <p className="text-white/30 text-sm">Accepts .xlsx and .xls files</p>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile}/>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && !done && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-white font-semibold">{rows.length} rows detected</span>
              <span className="text-green-400 text-sm">✓ {validRows.length} valid</span>
              {errorRows.length > 0 && <span className="text-red-400 text-sm">✕ {errorRows.length} errors</span>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setRows([]); if(fileRef.current) fileRef.current.value = '' }}
                className="btn-secondary text-sm">
                ← Change File
              </button>
              <button onClick={runImport} disabled={importing || validRows.length === 0}
                className="btn-primary flex items-center gap-2">
                <Upload size={16}/>
                {importing ? `Importing…` : `Import ${validRows.length} Players`}
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Row','Name','DOB','Category','Position','Guardian','Phone','Status'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-bold text-white/30 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                      <td className="px-3 py-2.5 text-white/30 text-xs">{r.row}</td>
                      <td className="px-3 py-2.5 text-white font-medium">{r.full_name}</td>
                      <td className="px-3 py-2.5 text-white/60">{r.date_of_birth}</td>
                      <td className="px-3 py-2.5">
                        <span className={`badge text-xs ${r.category === 'U9' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : r.category === 'U13' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-teal-500/20 text-teal-300 border-teal-500/30'}`}>
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-white/60">{r.position}</td>
                      <td className="px-3 py-2.5 text-white/60">{r.guardian_name}</td>
                      <td className="px-3 py-2.5 text-white/60">{r.guardian_phone}</td>
                      <td className="px-3 py-2.5">
                        {r.status === 'error' ? (
                          <div>
                            <span className="text-red-400 text-xs font-semibold">Error</span>
                            <p className="text-red-400/60 text-xs">{r.error}</p>
                          </div>
                        ) : (
                          <span className="text-green-400 text-xs">✓ Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Import progress */}
      {importing && (
        <div className="card p-6 text-center mt-4">
          <div className="animate-spin w-10 h-10 border-2 border-teal-400/30 border-t-teal-400 rounded-full mx-auto mb-4"/>
          <p className="text-white font-semibold">Importing players…</p>
          <p className="text-white/30 text-sm mt-1">Please wait, do not close this page</p>
        </div>
      )}

      {/* Results */}
      {done && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5 text-center border-green-500/20">
              <CheckCircle size={32} className="text-green-400 mx-auto mb-2"/>
              <div className="text-3xl font-black font-condensed text-green-400">{results.success}</div>
              <div className="text-white/40 text-sm mt-1">Players imported</div>
            </div>
            <div className="card p-5 text-center border-red-500/20">
              <XCircle size={32} className="text-red-400/60 mx-auto mb-2"/>
              <div className="text-3xl font-black font-condensed text-red-400">{results.failed}</div>
              <div className="text-white/40 text-sm mt-1">Failed</div>
            </div>
          </div>

          {results.failed > 0 && (
            <div className="card p-4">
              <h3 className="text-white font-bold text-sm mb-3">Failed rows — fix and re-import:</h3>
              {rows.filter(r => r.status === 'error').map((r, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
                  <XCircle size={14} className="text-red-400 flex-shrink-0 mt-0.5"/>
                  <div>
                    <span className="text-white text-sm font-medium">{r.full_name}</span>
                    <span className="text-white/30 text-xs ml-2">Row {r.row}</span>
                    <p className="text-red-400/70 text-xs mt-0.5">{r.error}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/coach/players" className="btn-primary flex-1 text-center">
              View All Players →
            </Link>
            <button onClick={() => { setRows([]); setDone(false); if(fileRef.current) fileRef.current.value = '' }}
              className="btn-secondary">
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
