'use client'
import { useRef, useState } from 'react'
import { Player } from '@/types/database'
import { Download, Phone } from 'lucide-react'
import jsQR from 'jsqr'
import { toast } from 'react-hot-toast'

interface PassCardProps {
  player: Player
  qrUrl?: string
  logoUrl?: string
  clubName?: string
  guardianPhone?: string
  guardianPhone2?: string
}

// Guardian contact chip — front of the card only (the club's physical
// template only ever carried the contact number on the front). Supports
// the "primary/secondary" notation: pass both numbers and they render as
// "primary / secondary"; pass only one and it renders alone.
//
// Alignment note: this deliberately does NOT pin a fixed height and try to
// match a line-height to it — that's what caused the icon/number to drift
// out of sync before (text line-height and an icon's own rendered box
// don't reliably agree, especially once this gets rasterized by
// html2canvas). Plain flex `alignItems: 'center'` on two children, neither
// height-constrained, is what actually keeps them level regardless of font
// metrics.
function GuardianBadge({ phone, phone2 }: { phone?: string; phone2?: string }) {
  if (!phone) return null
  const secondary = phone2 && phone2 !== phone ? phone2 : undefined
  return (
    <div style={{
      marginTop: 7, display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 4px',
      background: 'rgba(78,198,198,0.08)', border: '1px solid rgba(78,198,198,0.25)', borderRadius: 20,
    }}>
      <div style={{ width: 16, height: 16, borderRadius: '50%', background: 'rgba(78,198,198,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Phone size={9} color="#4EC6C6" strokeWidth={2.5}/>
      </div>
      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 9, fontWeight: 600, lineHeight: 1, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
        {phone}{secondary ? ` / ${secondary}` : ''}
      </span>
    </div>
  )
}

// Club logo medallion — used as the photo placeholder when a player has no
// photo yet. Deliberately NOT wrapped in the rectangular photo frame the
// real-photo case uses: that frame was forcing the logo into a non-square
// box, which is what read as "distorted" once downloaded. This renders the
// logo directly on the card as its own circle, sized generously, with
// objectFit:cover so it fills the circle edge-to-edge (cropping slightly)
// rather than shrinking to fit with dead space around it.
function LogoMedallion({ logoUrl, size = 128 }: { logoUrl?: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: '#0D1B2A', border: '2px solid rgba(78,198,198,0.45)',
      boxShadow: '0 0 14px rgba(78,198,198,0.3), inset 0 0 10px rgba(78,198,198,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {logoUrl ? (
        <img src={logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Club logo"/>
      ) : (
        <span style={{ color: '#4EC6C6', fontWeight: 900, fontSize: size * 0.16, letterSpacing: 0 }}>OPFC</span>
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

      {/* Player photo — right side, in a portrait frame. With no photo yet,
          the club logo renders directly as its own circular medallion
          instead (no surrounding frame — see LogoMedallion above). */}
      {player.photo_url ? (
        <div style={{
          position: 'absolute', right: 16, top: 50, width: 112, height: 140, borderRadius: 10, overflow: 'hidden',
          border: '2px solid rgba(78,198,198,0.3)', background: 'rgba(78,198,198,0.05)',
          boxShadow: '0 0 12px rgba(78,198,198,0.15)',
        }}>
          <img src={player.photo_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={player.full_name}/>
        </div>
      ) : (
        <div style={{ position: 'absolute', right: 8, top: 56 }}>
          <LogoMedallion logoUrl={logoUrl} size={128}/>
        </div>
      )}

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

// Card Back — QR only. No contact number here — the club's own template
// only ever carries it on the front.
export function PassCardBack({ player, qrUrl }: { player: Player; qrUrl?: string }) {
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

        // Decode the QR straight out of the exact pixels that just went
        // into the PDF — not a freshly-generated reference copy — so this
        // catches a genuinely broken/misrendered code, not just a typo in
        // what we intended to encode.
        const ctx = c.getContext('2d')
        if (ctx) {
          const img = ctx.getImageData(0, 0, c.width, c.height)
          const decoded = jsQR(img.data, c.width, c.height)
          const expected = `opfc://player/${player.id}`
          if (!decoded || decoded.data !== expected) {
            toast.error(`QR code could not be verified for ${player.full_name} — check the printed card before handing it out`, { duration: 6000 })
          }
        }
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
        <div ref={backRef}><PassCardBack player={player} qrUrl={qrUrl}/></div>
      </div>
      <button onClick={downloadCard} disabled={downloading} className="btn-primary flex items-center gap-2 w-full justify-center">
        <Download size={15}/>{downloading ? 'Generating…' : 'Download Pass Card (Front + Back)'}
      </button>
      <p className="text-white/20 text-xs text-center">Standard credit card size (85.6 × 54mm) · Print double-sided · Laminate</p>
    </div>
  )
}
