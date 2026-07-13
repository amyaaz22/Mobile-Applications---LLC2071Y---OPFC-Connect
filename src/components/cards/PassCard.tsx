'use client'
import { useRef, useState } from 'react'
import { Player } from '@/types/database'
import { Download } from 'lucide-react'

interface PassCardProps {
  player: Player
  qrUrl?: string
  logoUrl?: string
  clubName?: string
}

// Card Front — Club Pass
export function PassCardFront({ player, logoUrl, clubName }: { player: Player; logoUrl?: string; clubName?: string }) {
  const season = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
  const initials = player.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 3).toUpperCase()

  return (
    <div style={{
      width: 340, height: 214,
      background: 'linear-gradient(145deg, #0D1B2A 0%, #132030 40%, #1A2E45 100%)',
      borderRadius: 14, border: '2px solid rgba(78,198,198,0.35)',
      position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #4EC6C6, #2A8080)' }}/>

      {/* Diagonal background accent */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 140, height: '100%', background: 'linear-gradient(135deg, transparent 30%, rgba(78,198,198,0.04) 100%)' }}/>

      {/* Club Logo — top left */}
      <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        {logoUrl ? (
          <img src={logoUrl} style={{ width: 36, height: 36, objectFit: 'contain' }} alt="Club logo"/>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#4EC6C6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#0D1B2A', fontWeight: 900, fontSize: 8, letterSpacing: 0 }}>OPFC</span>
          </div>
        )}
        <div>
          <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
            {clubName ?? 'Oasis Pailles FC'}
          </div>
          <div style={{ color: '#4EC6C6', fontSize: 8, letterSpacing: 0.3 }}>Season {season}</div>
        </div>
      </div>

      {/* Category badge — top right */}
      <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(78,198,198,0.15)', border: '1px solid rgba(78,198,198,0.5)', borderRadius: 20, padding: '4px 10px' }}>
        <span style={{ color: '#4EC6C6', fontSize: 10, fontWeight: 800 }}>{player.category}</span>
      </div>

      {/* Player photo — right side */}
      <div style={{ position: 'absolute', right: 16, top: 50, width: 112, height: 140, borderRadius: 10, overflow: 'hidden', border: '2px solid rgba(78,198,198,0.25)', background: 'rgba(78,198,198,0.05)' }}>
        {player.photo_url ? (
          <img src={player.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={player.full_name}/>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 60 80" width={60} height={80} fill="rgba(78,198,198,0.25)">
              <circle cx="30" cy="20" r="16"/>
              <path d="M4 80 C4 50 56 50 56 80"/>
            </svg>
          </div>
        )}
      </div>

      {/* Player info — left side */}
      <div style={{ position: 'absolute', left: 14, top: 54, right: 144 }}>
        {/* Large initials */}
        <div style={{ color: '#4EC6C6', fontSize: 42, fontWeight: 900, lineHeight: 1, letterSpacing: -1, textShadow: '0 0 30px rgba(78,198,198,0.3)' }}>
          {initials}
        </div>

        {/* Full name */}
        <div style={{ color: 'white', fontSize: 11, fontWeight: 700, marginTop: 6, lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {player.full_name}
        </div>

        {/* Nationality */}
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, marginTop: 3 }}>
          {player.nationality}
        </div>
      </div>

      {/* Player code — bottom left */}
      <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 7, fontFamily: 'monospace', letterSpacing: 1 }}>
          {player.player_code} · OPFC CONNECT
        </div>
      </div>

      {/* Bottom teal line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #4EC6C6 0%, rgba(78,198,198,0.2) 70%, transparent 100%)' }}/>
    </div>
  )
}

// Card Back — QR only
export function PassCardBack({ player, qrUrl }: { player: Player; qrUrl?: string }) {
  return (
    <div style={{
      width: 340, height: 214,
      background: 'linear-gradient(145deg, #091520 0%, #0D1B2A 100%)',
      borderRadius: 14, border: '2px solid rgba(78,198,198,0.35)',
      position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #4EC6C6, #2A8080)' }}/>

      {/* QR section */}
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {qrUrl ? (
          <img src={qrUrl} style={{ width: 140, height: 140, borderRadius: 8 }} alt="QR Code"/>
        ) : (
          <div style={{ width: 140, height: 140, background: 'rgba(78,198,198,0.05)', borderRadius: 8, border: '1px dashed rgba(78,198,198,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(78,198,198,0.3)', fontSize: 11 }}>QR</div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 7, textAlign: 'center', letterSpacing: 0.5 }}>SCAN TO CHECK IN</div>
      </div>

      {/* Info section */}
      <div style={{ flex: 1, padding: '18px 18px 18px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ color: '#4EC6C6', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Attendance Card</div>
        <div style={{ color: 'white', fontSize: 14, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.2 }}>{player.full_name}</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>{player.player_code}</div>
        <div style={{ marginTop: 8, padding: '4px 10px', background: 'rgba(78,198,198,0.1)', border: '1px solid rgba(78,198,198,0.25)', borderRadius: 20, display: 'inline-block', width: 'fit-content' }}>
          <span style={{ color: '#4EC6C6', fontSize: 9, fontWeight: 700 }}>{player.category}</span>
        </div>
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.15)', fontSize: 7 }}>Oasis Pailles Football Club</div>
        <div style={{ color: 'rgba(78,198,198,0.3)', fontSize: 6, fontStyle: 'italic' }}>Omnis Tactus, Officium</div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #4EC6C6 0%, rgba(78,198,198,0.2) 70%, transparent 100%)' }}/>
    </div>
  )
}

// Full Pass Card with download
export default function PassCard({ player, qrUrl, logoUrl, clubName }: PassCardProps) {
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  async function downloadCard() {
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85.6, 54] })

      if (frontRef.current) {
        const c = await html2canvas(frontRef.current, { scale: 3, backgroundColor: '#0D1B2A', useCORS: true })
        pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54)
      }
      if (backRef.current) {
        pdf.addPage()
        const c = await html2canvas(backRef.current, { scale: 3, backgroundColor: '#091520', useCORS: true })
        pdf.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, 85.6, 54)
      }
      pdf.save(`OPFC_Pass_${player.player_code}_${player.full_name.replace(/\s+/g,'_')}.pdf`)
    } finally { setDownloading(false) }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div>
        <p className="section-title mb-2 text-center text-xs">FRONT</p>
        <div ref={frontRef}><PassCardFront player={player} logoUrl={logoUrl} clubName={clubName}/></div>
      </div>
      <div>
        <p className="section-title mb-2 text-center text-xs">BACK (QR)</p>
        <div ref={backRef}><PassCardBack player={player} qrUrl={qrUrl}/></div>
      </div>
      <button onClick={downloadCard} disabled={downloading} className="btn-primary flex items-center gap-2 w-full justify-center">
        <Download size={15}/>{downloading ? 'Generating…' : 'Download Pass Card (Front + Back)'}
      </button>
      <p className="text-white/20 text-xs text-center">Standard credit card size (85.6 × 54mm) · Print double-sided · Laminate</p>
    </div>
  )
}
