'use client'
import { useRef, useState } from 'react'
import { Player } from '@/types/database'
import { Download, Edit3, Save, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'

interface FanCardData {
  fav_club?: string
  fav_club_short?: string
  fav_intl_team?: string
  fav_intl_code?: string
  idol_name?: string
  idol_number?: number
  nickname?: string
}

interface FanCardProps {
  player: Player
  data: FanCardData
  canEdit?: boolean
  onSaved?: (data: FanCardData) => void
}

const COUNTRY_FLAGS: Record<string, string> = {
  'Mauritian': '🇲🇺',
  'French': '🇫🇷',
  'British': '🇬🇧',
  'South African': '🇿🇦',
  'Brazilian': '🇧🇷',
  'Argentinian': '🇦🇷',
  'Portuguese': '🇵🇹',
  'Indian': '🇮🇳',
  'Malagasy': '🇲🇬',
  'Seychellois': '🇸🇨',
}

function getFlag(nationality: string) {
  return COUNTRY_FLAGS[nationality] ?? '🏳️'
}

// The visual card
export function FanCardVisual({ player, data }: { player: Player; data: FanCardData }) {
  const season = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
  const initials = player.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
  const flag = getFlag(player.nationality)
  const isMauritian = player.nationality === 'Mauritian'

  return (
    <div style={{
      width: 340, height: 214,
      borderRadius: 14, overflow: 'hidden', position: 'relative',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      background: 'linear-gradient(135deg, #0D2035 0%, #0A1828 50%, #061018 100%)',
      border: '2px solid rgba(78,198,198,0.3)',
    }}>
      {/* Background pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.04 }}>
        {[...Array(8)].map((_, i) => (
          <div key={i} style={{ position: 'absolute', borderRadius: '50%', border: '1px solid #4EC6C6', width: 60 + i*30, height: 60 + i*30, top: '50%', left: '60%', transform: 'translate(-50%,-50%)' }}/>
        ))}
      </div>

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #4EC6C6, #2A8080, #4EC6C6)' }}/>

      {/* Logo top-left */}
      <div style={{ position: 'absolute', top: 12, left: 12, width: 28, height: 28, borderRadius: '50%', background: '#4EC6C6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#0D1B2A', fontWeight: 900, fontSize: 6 }}>OPFC</span>
      </div>

      {/* Season */}
      <div style={{ position: 'absolute', top: 16, left: 46, color: 'rgba(255,255,255,0.3)', fontSize: 7 }}>{season}</div>

      {/* Flag + category — top right */}
      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
        {isMauritian && <span style={{ fontSize: 18 }}>{flag}</span>}
        <div style={{ background: 'rgba(78,198,198,0.15)', border: '1px solid rgba(78,198,198,0.4)', borderRadius: 20, padding: '3px 8px' }}>
          <span style={{ color: '#4EC6C6', fontSize: 9, fontWeight: 800 }}>{player.category}</span>
        </div>
      </div>

      {/* LEFT SIDE — Player info */}
      <div style={{ position: 'absolute', left: 12, top: 44, width: 160 }}>
        {/* Large initials */}
        <div style={{ fontSize: 56, fontWeight: 900, color: '#4EC6C6', lineHeight: 1, letterSpacing: -3, textShadow: '0 0 40px rgba(78,198,198,0.4)' }}>
          {initials}
        </div>

        {/* Name */}
        <div style={{ color: 'white', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2, lineHeight: 1.3 }}>
          {player.full_name}
        </div>

        {/* Nickname */}
        {data.nickname && (
          <div style={{ color: '#4EC6C6', fontSize: 8, marginTop: 2, fontStyle: 'italic' }}>"{data.nickname}"</div>
        )}
      </div>

      {/* RIGHT SIDE — Photo */}
      <div style={{ position: 'absolute', right: 12, top: 40, width: 100, height: 120, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(78,198,198,0.2)', background: 'rgba(78,198,198,0.05)' }}>
        {player.photo_url ? (
          <img src={player.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={player.full_name} crossOrigin="anonymous"/>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 50 70" width={50} height={70} fill="rgba(78,198,198,0.2)">
              <circle cx="25" cy="17" r="13"/>
              <path d="M3 70 C3 42 47 42 47 70"/>
            </svg>
          </div>
        )}
      </div>

      {/* BOTTOM — Fan preferences */}
      <div style={{ position: 'absolute', bottom: 10, left: 12, right: 12 }}>
        {/* Divider */}
        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(78,198,198,0.4), rgba(78,198,198,0.1), transparent)', marginBottom: 7 }}/>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Favourite club */}
          {data.fav_club_short && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: 7, fontWeight: 800 }}>{data.fav_club_short}</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 6, marginTop: 2 }}>FAV CLUB</span>
            </div>
          )}

          {/* International team */}
          {data.fav_intl_code && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: 7, fontWeight: 800 }}>{data.fav_intl_code}</span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 6, marginTop: 2 }}>INT'L</span>
            </div>
          )}

          {/* Divider */}
          {(data.fav_club_short || data.fav_intl_code) && data.idol_name && (
            <div style={{ width: 1, height: 30, background: 'rgba(78,198,198,0.2)' }}/>
          )}

          {/* Idol */}
          {data.idol_name && (
            <div style={{ flex: 1 }}>
              {/* Jersey icon */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ position: 'relative', width: 26, height: 26 }}>
                  <svg viewBox="0 0 40 40" width={26} height={26}>
                    <path d="M8 8 L14 4 L20 7 L26 4 L32 8 L36 16 L28 18 L28 36 L12 36 L12 18 L4 16 Z" fill="rgba(78,198,198,0.2)" stroke="rgba(78,198,198,0.5)" strokeWidth="1.5"/>
                    <text x="20" y="28" textAnchor="middle" fill="#4EC6C6" fontSize="10" fontWeight="900">{data.idol_number ?? ''}</text>
                  </svg>
                </div>
                <div>
                  <div style={{ color: 'white', fontSize: 11, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {data.idol_name} {data.idol_number ? `#${data.idol_number}` : ''}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 6 }}>IDOL</div>
                </div>
              </div>
            </div>
          )}

          {/* Decorative football — far right */}
          <div style={{ marginLeft: 'auto' }}>
            <svg viewBox="0 0 30 30" width={28} height={28} opacity={0.2}>
              <circle cx="15" cy="15" r="13" fill="none" stroke="#4EC6C6" strokeWidth="1.5"/>
              <polygon points="15,5 19,10 15,15 11,10" fill="rgba(78,198,198,0.4)"/>
              <polygon points="15,15 20,18 18,24 12,24 10,18" fill="rgba(78,198,198,0.3)"/>
              <polygon points="15,5 22,10 20,18 15,15 10,18 8,10" fill="none" stroke="#4EC6C6" strokeWidth="0.8"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #4EC6C6 0%, rgba(78,198,198,0.3) 70%, transparent 100%)' }}/>
    </div>
  )
}

// Edit form for parents
function FanCardEditor({ player, data, onSave, onCancel }: { player: Player; data: FanCardData; onSave: (d: FanCardData) => void; onCancel: () => void }) {
  const [form, setForm] = useState<FanCardData>({ ...data })
  const set = (k: keyof FanCardData, v: any) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="card p-5 mt-4 space-y-4">
      <h3 className="text-white font-bold text-sm">Customise Fan Card</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label mb-1 block">Favourite Club</label>
          <input className="input text-sm" placeholder="e.g. Manchester United" value={form.fav_club ?? ''} onChange={e => set('fav_club', e.target.value)}/>
        </div>
        <div>
          <label className="label mb-1 block">Short Code</label>
          <input className="input text-sm" placeholder="e.g. MUFC" maxLength={6} value={form.fav_club_short ?? ''} onChange={e => set('fav_club_short', e.target.value.toUpperCase())}/>
        </div>
        <div>
          <label className="label mb-1 block">Favourite Int'l Team</label>
          <input className="input text-sm" placeholder="e.g. France" value={form.fav_intl_team ?? ''} onChange={e => set('fav_intl_team', e.target.value)}/>
        </div>
        <div>
          <label className="label mb-1 block">Country Code</label>
          <input className="input text-sm" placeholder="e.g. FRA" maxLength={4} value={form.fav_intl_code ?? ''} onChange={e => set('fav_intl_code', e.target.value.toUpperCase())}/>
        </div>
        <div>
          <label className="label mb-1 block">Idol Name</label>
          <input className="input text-sm" placeholder="e.g. Ronaldo" value={form.idol_name ?? ''} onChange={e => set('idol_name', e.target.value)}/>
        </div>
        <div>
          <label className="label mb-1 block">Idol Number</label>
          <input className="input text-sm" type="number" min={1} max={99} placeholder="e.g. 7" value={form.idol_number ?? ''} onChange={e => set('idol_number', +e.target.value || undefined)}/>
        </div>
        <div className="col-span-2">
          <label className="label mb-1 block">Nickname (optional)</label>
          <input className="input text-sm" placeholder="e.g. 'Flash'" value={form.nickname ?? ''} onChange={e => set('nickname', e.target.value)}/>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => onSave(form)} className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm">
          <Save size={14}/> Save Card
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm"><X size={14}/></button>
      </div>
    </div>
  )
}

// Full Fan Card with edit + download
export default function FanCard({ player, data: initialData, canEdit = false, onSaved }: FanCardProps) {
  const supabase = createClient()
  const cardRef = useRef<HTMLDivElement>(null)
  const [data, setData] = useState<FanCardData>(initialData)
  const [editing, setEditing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  async function handleSave(newData: FanCardData) {
    const { error } = await supabase.from('fan_card').upsert({
      player_id: player.id,
      ...newData,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id' })

    if (error) { toast.error('Failed to save'); return }
    setData(newData)
    setEditing(false)
    onSaved?.(newData)
    toast.success('Fan card saved!')
  }

  async function downloadFanCard() {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF } = await import('jspdf')
      const canvas = await html2canvas(cardRef.current, { scale: 3, backgroundColor: '#0D1B2A', useCORS: true })
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54)
      pdf.save(`OPFC_FanCard_${player.full_name.replace(/\s+/g,'_')}.pdf`)
    } finally { setDownloading(false) }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div ref={cardRef}>
        <FanCardVisual player={player} data={data}/>
      </div>

      <div className="flex gap-2 w-full">
        {canEdit && (
          <button onClick={() => setEditing(!editing)} className="btn-secondary flex items-center gap-2 text-sm flex-1 justify-center">
            <Edit3 size={14}/>{editing ? 'Cancel' : 'Customise'}
          </button>
        )}
        <button onClick={downloadFanCard} disabled={downloading} className="btn-primary flex items-center gap-2 text-sm flex-1 justify-center">
          <Download size={14}/>{downloading ? 'Generating…' : 'Download Fan Card'}
        </button>
      </div>

      {editing && (
        <FanCardEditor player={player} data={data} onSave={handleSave} onCancel={() => setEditing(false)}/>
      )}
    </div>
  )
}
