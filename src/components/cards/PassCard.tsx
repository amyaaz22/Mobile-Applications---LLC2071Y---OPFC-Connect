'use client'
import { useEffect, useRef, useState } from 'react'
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

// ─────────────────────────────────────────────────────────────────────────────
// Image preparation for the card.
//
// html2canvas 1.4.x (what produces the downloaded PDF) does NOT implement the
// CSS `object-fit` property — it just stretches the <img> to its box. That is
// why the logo looked fine on screen but came out squashed/stretched (and tiny,
// because it was shrunk to sit inside a medallion) in the download. So the
// cropping is done here, on a canvas, and the card renders a plain <img> whose
// width/height already match the picture's real aspect ratio.
// ─────────────────────────────────────────────────────────────────────────────
export interface PreparedImage { src: string; w: number; h: number }

const prepared = new Map<string, PreparedImage | null>()
const pending = new Map<string, Promise<PreparedImage | null>>()

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image failed to load'))
    img.src = url
  })
}

// Crop away the empty margin around the club crest — transparent padding, or a
// flat background colour matching the corners — so the crest itself fills the
// space it is given instead of floating small inside its own canvas.
function trimMargins(img: HTMLImageElement): PreparedImage {
  const MAX = 800
  const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
  const W = Math.max(1, Math.round(img.naturalWidth * k))
  const H = Math.max(1, Math.round(img.naturalHeight * k))
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(img, 0, 0, W, H)
  const { data } = ctx.getImageData(0, 0, W, H)

  const px = (x: number, y: number) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]] }
  const corners = [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)]
  const transparentBg = corners.every(c => c[3] < 20)
  const bg = [0, 1, 2].map(ch => corners.reduce((a, c) => a + c[ch], 0) / 4)
  const cornersAgree = corners.every(c => Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]) < 36)

  const isContent = (i: number) => {
    if (transparentBg) return data[i + 3] > 24
    if (!cornersAgree) return data[i + 3] > 24
    if (data[i + 3] < 24) return false
    return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 48
  }

  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (isContent((y * W + x) * 4)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  // Nothing detected (or an implausibly tiny box) — keep the picture whole.
  if (x1 < 0 || (x1 - x0) < W * 0.1 || (y1 - y0) < H * 0.1) return { src: c.toDataURL('image/png'), w: W, h: H }

  const padX = Math.round((x1 - x0) * 0.02), padY = Math.round((y1 - y0) * 0.02)
  x0 = Math.max(0, x0 - padX); y0 = Math.max(0, y0 - padY)
  x1 = Math.min(W - 1, x1 + padX); y1 = Math.min(H - 1, y1 + padY)
  const w = x1 - x0 + 1, h = y1 - y0 + 1
  const out = document.createElement('canvas'); out.width = w; out.height = h
  out.getContext('2d')!.drawImage(c, x0, y0, w, h, 0, 0, w, h)
  return { src: out.toDataURL('image/png'), w, h }
}

// Centre-crop a photo to the frame's aspect ratio (what object-fit: cover does
// on screen, but baked into the pixels so the PDF matches).
function coverCrop(img: HTMLImageElement, aspect: number): PreparedImage {
  const nw = img.naturalWidth, nh = img.naturalHeight
  let sw = nw, sh = nw / aspect
  if (sh > nh) { sh = nh; sw = nh * aspect }
  const sx = (nw - sw) / 2, sy = (nh - sh) / 2
  const k = Math.min(1, 900 / Math.max(sw, sh))
  const w = Math.round(sw * k), h = Math.round(sh * k)
  const out = document.createElement('canvas'); out.width = w; out.height = h
  out.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, w, h)
  return { src: out.toDataURL('image/jpeg', 0.92), w, h }
}

type PrepMode = { kind: 'trim' } | { kind: 'cover'; aspect: number }
const keyOf = (url: string, m: PrepMode) => m.kind === 'trim' ? `trim|${url}` : `cover${m.aspect.toFixed(3)}|${url}`

// Resolves once the prepared image is cached. Falls back to null (caller then
// uses the raw URL) if the host does not allow canvas access.
export function prepareImage(url: string | undefined, mode: PrepMode): Promise<PreparedImage | null> {
  if (!url) return Promise.resolve(null)
  const key = keyOf(url, mode)
  if (prepared.has(key)) return Promise.resolve(prepared.get(key) ?? null)
  let p = pending.get(key)
  if (!p) {
    p = loadImage(url)
      .then(img => (mode.kind === 'trim' ? trimMargins(img) : coverCrop(img, mode.aspect)))
      .catch(() => null)
      .then(r => { prepared.set(key, r); pending.delete(key); return r })
    pending.set(key, p)
  }
  return p
}

export const preloadLogo = (logoUrl?: string) => prepareImage(logoUrl, { kind: 'trim' })

function usePrepared(url: string | undefined, mode: PrepMode): PreparedImage | null | undefined {
  const key = url ? keyOf(url, mode) : ''
  // undefined = still working; null = could not prepare (use the raw URL)
  const [val, setVal] = useState<PreparedImage | null | undefined>(() => (url && prepared.has(key) ? prepared.get(key) : url ? undefined : null))
  useEffect(() => {
    if (!url) { setVal(null); return }
    if (prepared.has(key)) { setVal(prepared.get(key)); return }
    let live = true
    prepareImage(url, mode).then(r => { if (live) setVal(r) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return val
}

// The club crest, shown bare (no frame) at the largest size that fits the box
// while keeping its true proportions.
function ClubLogo({ logoUrl, maxW, maxH }: { logoUrl?: string; maxW: number; maxH: number }) {
  const img = usePrepared(logoUrl, { kind: 'trim' })
  if (logoUrl && img) {
    const s = Math.min(maxW / img.w, maxH / img.h)
    return <img src={img.src} width={Math.round(img.w * s)} height={Math.round(img.h * s)} style={{ display: 'block' }} alt="Club logo"/>
  }
  if (logoUrl && img === undefined) return <div style={{ width: maxW, height: maxH }}/>
  return <span style={{ color: '#4EC6C6', fontWeight: 900, fontSize: 34, letterSpacing: 1 }}>OPFC</span>
}

const PHOTO_W = 112, PHOTO_H = 140
function PlayerPhoto({ url, name }: { url: string; name: string }) {
  const img = usePrepared(url, { kind: 'cover', aspect: PHOTO_W / PHOTO_H })
  if (img === undefined) return null
  return <img src={img ? img.src : url} width={PHOTO_W} height={PHOTO_H} style={{ display: 'block' }} alt={name}/>
}

// Guardian contact — front of the card only. Supports the club's
// "primary / secondary" notation. Built from fixed-size, absolutely placed
// parts rather than flex centring: html2canvas positions text and inline SVG
// by their own line boxes, so flex "align-items: center" drifted the icon and
// the number apart in the downloaded card.
function GuardianContact({ phone, phone2 }: { phone?: string; phone2?: string }) {
  if (!phone) return null
  const secondary = phone2 && phone2 !== phone ? phone2 : undefined
  const text = secondary ? `${phone} / ${secondary}` : phone
  const H = 18
  return (
    <div style={{ position: 'relative', marginTop: 9, height: H, paddingLeft: H + 7, whiteSpace: 'nowrap' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: H, height: H, borderRadius: '50%', background: 'rgba(78,198,198,0.18)', border: '1px solid rgba(78,198,198,0.45)', boxSizing: 'border-box' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: H - 2, height: H - 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Phone size={10} color="#4EC6C6" strokeWidth={2.4} style={{ display: 'block' }}/>
        </div>
      </div>
      <span style={{ display: 'block', height: H, lineHeight: `${H}px`, color: 'rgba(255,255,255,0.92)', fontSize: 10, fontWeight: 700, letterSpacing: 0.3 }}>
        {text}
      </span>
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

      {/* Club name — top left */}
      <div style={{ position: 'absolute', top: 14, left: 14, color: 'rgba(255,255,255,0.9)', fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>
        {clubName ?? 'Oasis Pailles FC'}
      </div>

      {/* Right side: the player's photo when there is one, otherwise the club
          crest — large and frameless, centred in the same space. */}
      {player.photo_url ? (
        <div style={{
          position: 'absolute', right: 16, top: 50, width: PHOTO_W, height: PHOTO_H, borderRadius: 10, overflow: 'hidden',
          border: '2px solid rgba(78,198,198,0.3)', boxShadow: '0 0 12px rgba(78,198,198,0.15)',
        }}>
          <PlayerPhoto url={player.photo_url} name={player.full_name}/>
        </div>
      ) : (
        <div style={{ position: 'absolute', right: 16, top: 34, width: 116, height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClubLogo logoUrl={logoUrl} maxW={116} maxH={160}/>
        </div>
      )}

      {/* Player info — left side */}
      <div style={{ position: 'absolute', left: 14, top: 54, right: 150 }}>
        <div style={{ color: '#4EC6C6', fontSize: 42, fontWeight: 900, lineHeight: 1, letterSpacing: -1 }}>
          {initials}
        </div>
        <div style={{ color: 'white', fontSize: 11, fontWeight: 700, marginTop: 6, lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: 0.3 }}>
          {player.full_name}
        </div>
        <GuardianContact phone={guardianPhone} phone2={guardianPhone2}/>
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

// Card Back — QR + identity. No contact number here: it lives on the front only.
// (guardianPhone props are still accepted so existing callers keep compiling.)
export function PassCardBack({ player, qrUrl }: { player: Player; qrUrl?: string; guardianPhone?: string; guardianPhone2?: string }) {
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
          <div style={{ padding: 4, borderRadius: 10, background: '#FFFFFF' }}>
            <img src={qrUrl} width={128} height={128} style={{ display: 'block', borderRadius: 6 }} alt="QR Code"/>
          </div>
        ) : (
          <div style={{ width: 140, height: 140, background: 'rgba(78,198,198,0.05)', borderRadius: 8, border: '1px dashed rgba(78,198,198,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(78,198,198,0.3)', fontSize: 11 }}>QR</div>
        )}
        <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 7, fontWeight: 700, textAlign: 'center', letterSpacing: 1 }}>SCAN TO CHECK IN</div>
      </div>

      {/* Info section */}
      <div style={{ flex: 1, padding: '18px 18px 18px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        <div style={{ color: '#4EC6C6', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Attendance Card</div>
        <div style={{ color: 'white', fontSize: 14, fontWeight: 800, textTransform: 'uppercase', lineHeight: 1.2 }}>{player.full_name}</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, marginTop: 2, fontFamily: 'monospace' }}>{player.player_code}</div>
        <div style={{ marginTop: 14, color: 'rgba(255,255,255,0.5)', fontSize: 7.5 }}>Oasis Pailles Football Club</div>
        <div style={{ color: 'rgba(78,198,198,0.65)', fontSize: 7, fontStyle: 'italic' }}>Omnis Tactus, Officium</div>
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
      await preloadLogo(logoUrl)
      if (player.photo_url) await prepareImage(player.photo_url, { kind: 'cover', aspect: PHOTO_W / PHOTO_H })
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
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
