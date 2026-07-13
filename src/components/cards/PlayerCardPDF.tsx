'use client'
import { useRef, useState } from 'react'
import { Player, PlayerStats } from '@/types/database'
import { Download } from 'lucide-react'

interface PlayerCardPDFProps {
  player: Player
  stats?: PlayerStats | null
  qrUrl?: string
}

// Card Front — clean design matching the sketch
function CardFront({ player }: { player: Player }) {
  const season = `${new Date().getFullYear()}/${new Date().getFullYear() + 1}`
  return (
    <div style={{
      width: 320, height: 200,
      background: 'linear-gradient(135deg, #0D1B2A 0%, #152238 60%, #1C3249 100%)',
      borderRadius: 12, border: '2px solid rgba(78,198,198,0.4)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
      fontFamily: 'Arial, sans-serif',
    }}>
      {/* Top teal bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#4EC6C6' }}/>

      {/* OPFC Badge top-left */}
      <div style={{ position: 'absolute', top: 12, left: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#4EC6C6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#0D1B2A', fontWeight: 900, fontSize: 8 }}>OPFC</span>
        </div>
        <div>
          <div style={{ color: '#4EC6C6', fontSize: 8, fontWeight: 700, letterSpacing: 1 }}>OASIS PAILLES FC</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 7 }}>Season {season}</div>
        </div>
      </div>

      {/* Category badge top-right */}
      <div style={{ position: 'absolute', top: 14, right: 14, background: 'rgba(78,198,198,0.15)', border: '1px solid rgba(78,198,198,0.4)', borderRadius: 6, padding: '3px 8px' }}>
        <span style={{ color: '#4EC6C6', fontSize: 9, fontWeight: 700 }}>{player.category}</span>
      </div>

      {/* Player photo / silhouette */}
      <div style={{ position: 'absolute', right: 14, top: 50, bottom: 14, width: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {player.photo_url ? (
          <img src={player.photo_url} style={{ width: 90, height: 110, objectFit: 'cover', borderRadius: 8, border: '2px solid rgba(78,198,198,0.3)' }}/>
        ) : (
          <div style={{ width: 90, height: 110, borderRadius: 8, background: 'rgba(78,198,198,0.08)', border: '1px solid rgba(78,198,198,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 60 80" width={60} height={80} fill="rgba(78,198,198,0.3)">
              <circle cx="30" cy="18" r="14"/>
              <path d="M5 80 C5 48 55 48 55 80"/>
            </svg>
          </div>
        )}
      </div>

      {/* Player name + initials */}
      <div style={{ position: 'absolute', left: 14, top: 58 }}>
        <div style={{ color: '#4EC6C6', fontSize: 28, fontWeight: 900, lineHeight: 1 }}>
          {player.full_name.split(' ').map((n: string) => n[0]).join('.')}
        </div>
        <div style={{ color: 'white', fontSize: 10, fontWeight: 700, marginTop: 4, maxWidth: 180 }}>
          {player.full_name.toUpperCase()}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 8, marginTop: 2 }}>{player.nationality}</div>
      </div>

      {/* Player code bottom left */}
      <div style={{ position: 'absolute', bottom: 12, left: 14 }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 7, fontFamily: 'monospace' }}>{player.player_code}</div>
      </div>

      {/* Bottom teal line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #4EC6C6, transparent)' }}/>
    </div>
  )
}

// Card Back — QR code
function CardBack({ player, qrUrl }: { player: Player; qrUrl?: string }) {
  return (
    <div style={{
      width: 320, height: 200,
      background: 'linear-gradient(135deg, #0D1B2A 0%, #091520 100%)',
      borderRadius: 12, border: '2px solid rgba(78,198,198,0.4)',
      position: 'relative', overflow: 'hidden', flexShrink: 0,
      fontFamily: 'Arial, sans-serif', display: 'flex', alignItems: 'center',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#4EC6C6' }}/>

      {/* QR Code */}
      <div style={{ padding: 16, flexShrink: 0 }}>
        {qrUrl ? (
          <img src={qrUrl} style={{ width: 130, height: 130, borderRadius: 8 }}/>
        ) : (
          <div style={{ width: 130, height: 130, background: 'rgba(78,198,198,0.1)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(78,198,198,0.4)', fontSize: 10 }}>QR CODE</div>
        )}
      </div>

      {/* Player info */}
      <div style={{ flex: 1, padding: '16px 16px 16px 0' }}>
        <div style={{ color: '#4EC6C6', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>ATTENDANCE CARD</div>
        <div style={{ color: 'white', fontSize: 13, fontWeight: 900, marginBottom: 2 }}>{player.full_name}</div>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 9, marginBottom: 8 }}>{player.player_code} · {player.category}</div>
        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 7, lineHeight: 1.6 }}>
          Scan at each<br/>training session
        </div>
        <div style={{ marginTop: 8, color: 'rgba(78,198,198,0.4)', fontSize: 7 }}>Oasis Pailles Football Club</div>
        <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 6, marginTop: 2, fontStyle: 'italic' }}>Omnis Tactus, Officium</div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, #4EC6C6, transparent)' }}/>
    </div>
  )
}

export default function PlayerCardPDF({ player, stats, qrUrl }: PlayerCardPDFProps) {
  const frontRef = useRef<HTMLDivElement>(null)
  const backRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  async function downloadBothSides() {
    setDownloading(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF } = await import('jspdf')

      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [85, 54] })

      if (frontRef.current) {
        const canvas = await html2canvas(frontRef.current, { scale: 3, backgroundColor: '#0D1B2A', useCORS: true })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 85, 54)
      }

      if (backRef.current) {
        pdf.addPage()
        const canvas = await html2canvas(backRef.current, { scale: 3, backgroundColor: '#0D1B2A', useCORS: true })
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 85, 54)
      }

      pdf.save(`OPFC_Card_${player.player_code}_${player.full_name.replace(/\s+/g, '_')}.pdf`)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Front */}
      <div>
        <p className="section-title mb-2 text-center">Card Front</p>
        <div ref={frontRef}><CardFront player={player}/></div>
      </div>

      {/* Back */}
      <div>
        <p className="section-title mb-2 text-center">Card Back (QR)</p>
        <div ref={backRef}><CardBack player={player} qrUrl={qrUrl}/></div>
      </div>

      {/* Single download button */}
      <button onClick={downloadBothSides} disabled={downloading}
        className="btn-primary flex items-center gap-2 w-full justify-center">
        <Download size={16}/>
        {downloading ? 'Generating PDF…' : 'Download Card (Front + Back)'}
      </button>

      <p className="text-white/20 text-xs text-center">
        PDF contains 2 pages — print double-sided and laminate
      </p>
    </div>
  )
}
