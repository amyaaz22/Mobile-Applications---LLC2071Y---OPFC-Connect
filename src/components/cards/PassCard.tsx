'use client'
import { useRef, useState } from 'react'
import { Player } from '@/types/database'
import { Download, Phone } from 'lucide-react'

interface PassCardProps {
  player: Player
  qrUrl?: string
  logoUrl?: string
  clubName?: string
  guardianPhone?: string
  guardianPhone2?: string
}

// Guardian contact chip — shared by front and back. Supports the club's
// "primary/secondary" notation: pass both numbers and they render as
// "primary / secondary"; pass only one and it renders alone.
function GuardianBadge({ phone, phone2 }: { phone?: string; phone2?: string }) {
  if (!phone) return null
  const secondary = phone2 && phone2 !== phone ? phone2 : undefined
  return (
    <div style={{
      marginTop: 7, display: 'inline-flex', alignItems: 'center', height: 20, gap: 6,
      padding: '0 10px 0 3px',
      background: 'rgba(78,198,198,0.08)', border: '1px solid rgba(78,198,198,0.25)', borderRadius: 10,
    }}>
      <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(78,198,198,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Phone size={8} color="#4EC6C6" strokeWidth={2.5} style={{ display: 'block' }}/>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: 600, lineHeight: '20px', letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
        {phone}{secondary ? ` / ${secondary}` : ''}
      </span>
    </div>
  )
}

// Fixed, always-square medallion for the club logo — used as the photo
// placeholder. A dedicated 1:1 wrapper (rather than sizing the <img> as a
// percentage of the non-square photo frame) is what actually prevents the
// logo from reading as squashed/stretched, regardless of the frame's own
// aspect ratio.
function LogoMedallion({ logoUrl, size = 80 }: { logoUrl?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: '#0D1B2A', border: '2px solid rgba(78,198,198,0.45)',
      boxShadow: '0 0 10px rgba(78,198,198,0.35), inset 0 0 8px rgba(78,198,198,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {logoUrl ? (
        <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} alt="Club logo"/>
      ) : (
        <span style={{ color: '#4EC6C6', fontWeight: 900, fontSize: size * 0.2, letterSpacing: 0 }}>OPFC</span>
      )}
    </div>
  )
}

// Card Front — Club Pass
export function PassCardFront({ player, logoUrl, clubName, guardianPhone, guardianPhone2 }: { player: Player; logoUrl?: string; clubName?: string; guardianPhone?: string; guardianPhone2?: string }) {
  const initials = player.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 3).toUpperCase()

  return (
    <div style={{
      width: 340, height: 214,
      background: 'linear-gradient(145deg, #0D1B2A 0%, #132030 40%, #1A2E45 100%)',
      borderRadius: 14, border: '2px solid rgba(78,198,198,0.4)',
      boxShadow: '0 0 0 1px rgba(78,198,198,0.08), 0 0 22px rgba(78,198,198,0.12)',
      position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif',
    }}>
      {/* Top accent bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #4EC6C6, #2A8080)' }}/>

      {/* Diagonal background accent */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: 140, height: '100%', background: 'linear-gradient(135deg, transparent 30%, rgba(78,198,198,0.04) 100%)' }}/>

      {/* Club name — top left, no logo/season here (logo moved into the photo slot below) */}
      <div style={{ position: 'absolute', top: 14, left: 14, color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
        {clubName ?? 'Oasis Pailles FC'}
      </div>

      {/* Player photo — right side. Falls back to a fixed-aspect logo
          medallion when there's no photo yet, instead of a generic silhouette. */}
      <div style={{
        position: 'absolute', right: 16, top: 50, width: 112, height: 140, borderRadius: 10, overflow: 'hidden',
        border: '2px solid rgba(78,198,198,0.3)', background: 'rgba(78,198,198,0.05)',
        boxShadow: '0 0 12px rgba(78,198,198,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {player.photo_url ? (
          <img src={player.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={player.full_name}/>
        ) : (
          <LogoMedallion logoUrl={logoUrl} size={80}/>
        )}
      </div>

      {/* Player info — left side */}
      <div style={{ position: 'absolute', left: 14, top: 54, right: 144 }}>
        {/* Large initials */}
        <div style={{ color: '#4EC6C6', fontSize: 42, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
          {initials}
        </div>

        {/* Full name */}
        <div style={{ color: 'white', fontSize: 11, fontWeight: 700, marginTop: 6, lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {player.full_name}
        </div>

        <GuardianBadge phone={guardianPhone} phone2={guardianPhone2}/>
      </div>

      {/* Member ID — bottom left */}
      <div style={{ position: 'absolute', bottom: 12, left: 14, color: 'rgba(255,255,255,0.35)', fontSize: 8, letterSpacing: 0.3 }}>
        Member ID: <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{player.player_code}</span>
      </div>

      {/* Bottom teal line */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #4EC6C6 0%, rgba(78,198,198,0.2) 70%, transparent 100%)' }}/>
    </div>
  )
}

// Card Back — QR only
export function PassCardBack({ player, qrUrl, guardianPhone, guardianPhone2 }: { player: Player; qrUrl?: string; guardianPhone?: string; guardianPhone2?: string }) {
  return (
    <div style={{
      width: 340, height: 214,
      background: 'linear-gradient(145deg, #091520 0%, #0D1B2A 100%)',
      borderRadius: 14, border: '2px solid rgba(78,198,198,0.4)',
      boxShadow: '0 0 0 1px rgba(78,198,198,0.08), 0 0 22px rgba(78,198,198,0.12)',
      position: 'relative', overflow: 'hidden', fontFamily: 'Arial, sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #4EC6C6, #2A8080)' }}/>

      {/* QR section */}
      <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        {qrUrl ? (
          <div style={{ padding: 6, borderRadius: 10, border: '1px solid rgba(78,198,198,0.25)', boxShadow: '0 0 12px rgba(78,198,198,0.18)' }}>
            <img src={qrUrl} style={{ width: 128, height: 128, display: 'block', borderRadius: 4 }} alt="QR Code"/>
          </div>
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
        <GuardianBadge phone={guardianPhone} phone2={guardianPhone2}/>
        <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.15)', fontSize: 7 }}>Oasis Pailles Football Club</div>
        <div style={{ color: 'rgba(78,198,198,0.3)', fontSize: 6, fontStyle: 'italic' }}>Omnis Tactus, Officium</div>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, #4EC6C6 0%, rgba(78,198,198,0.2) 70%, transparent 100%)' }}/>
    </div>
  )
}

// Full Pass Card with download
export default function PassCard({ player, qrUrl, logoUrl, clubName, guardianPhone, guardianPhone2 }: PassCardProps) {
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
        <div ref={frontRef}><PassCardFront player={player} logoUrl={logoUrl} clubName={clubName} guardianPhone={guardianPhone} guardianPhone2={guardianPhone2}/></div>
      </div>
      <div>
        <p className="section-title mb-2 text-center text-xs">BACK (QR)</p>
        <div ref={backRef}><PassCardBack player={player} qrUrl={qrUrl} guardianPhone={guardianPhone} guardianPhone2={guardianPhone2}/></div>
      </div>
      <button onClick={downloadCard} disabled={downloading} className="btn-primary flex items-center gap-2 w-full justify-center">
        <Download size={15}/>{downloading ? 'Generating…' : 'Download Pass Card (Front + Back)'}
      </button>
      <p className="text-white/20 text-xs text-center">Standard credit card size (85.6 × 54mm) · Print double-sided · Laminate</p>
    </div>
  )
}
