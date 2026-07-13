'use client'
import { useRef } from 'react'
import { Player, PlayerStats } from '@/types/database'
import { statColor, statBarColor, getAge, formatDate } from '@/lib/utils'
import { Download } from 'lucide-react'

interface PlayerCardProps {
  player: Player
  stats: PlayerStats | null
  showDownload?: boolean
  compact?: boolean
}

const STAT_LABELS = [
  { key: 'pac', label: 'PAC' },
  { key: 'sho', label: 'SHO' },
  { key: 'pas', label: 'PAS' },
  { key: 'dri', label: 'DRI' },
  { key: 'def', label: 'DEF' },
  { key: 'phy', label: 'PHY' },
] as const

function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-bold text-white/40 w-7 flex-shrink-0">{label}</span>
      <div className="stat-bar flex-1">
        <div
          className={`h-full rounded-full transition-all ${statBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-6 text-right flex-shrink-0 ${statColor(value)}`}>
        {value}
      </span>
    </div>
  )
}

export default function PlayerCard({ player, stats, showDownload = false, compact = false }: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const ovr = stats?.ovr ?? 0
  const hasStats = stats !== null

  async function downloadCard() {
    const { default: html2canvas } = await import('html2canvas')
    const { default: jsPDF } = await import('jspdf')
    if (!cardRef.current) return
    const canvas = await html2canvas(cardRef.current, { scale: 2, backgroundColor: '#0D1B2A' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 110] })
    pdf.addImage(imgData, 'PNG', 0, 0, 80, 110)
    pdf.save(`OPFC_${player.full_name.replace(/\s+/g, '_')}_Card.pdf`)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Card */}
      <div
        ref={cardRef}
        className={`relative rounded-2xl overflow-hidden select-none
          ${compact ? 'w-48' : 'w-64'}`}
        style={{
          background: 'linear-gradient(145deg, #152238 0%, #0D2035 50%, #0A1A2E 100%)',
          border: '2px solid rgba(78,198,198,0.3)',
          aspectRatio: '7/9',
        }}
      >
        {/* Top teal line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-400 to-teal-600"/>

        {/* Club badge */}
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-full bg-teal-400 flex items-center justify-center">
            <span className="text-navy-900 font-black text-[8px] font-condensed">OPFC</span>
          </div>
        </div>

        {/* OVR + Position */}
        <div className="absolute top-3 left-3">
          <div className={`font-black font-condensed leading-none text-teal-400 ${compact ? 'text-3xl' : 'text-4xl'}`}
            style={{ textShadow: '0 0 20px rgba(78,198,198,0.4)' }}>
            {hasStats ? ovr : '—'}
          </div>
          <div className="text-white/60 font-bold text-xs">{player.position}</div>
        </div>

        {/* Player silhouette / photo */}
        <div className="absolute inset-0 flex items-center justify-end pr-4 pt-4">
          {player.photo_url ? (
            <img src={player.photo_url} alt={player.full_name}
              className={`object-cover rounded-full border-2 border-teal-400/30 ${compact ? 'w-20 h-20' : 'w-28 h-28'}`}/>
          ) : (
            <div className={`rounded-full border-2 border-teal-400/10 bg-teal-400/5 flex items-center justify-center
              ${compact ? 'w-20 h-20' : 'w-28 h-28'}`}>
              <svg viewBox="0 0 100 120" className={`${compact ? 'w-14 h-14' : 'w-20 h-20'} opacity-30`} fill="rgba(78,198,198,0.6)">
                <circle cx="50" cy="28" r="22"/>
                <path d="M10 120 C10 75 90 75 90 120"/>
              </svg>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="absolute left-3 right-3 h-px bg-gradient-to-r from-teal-400/30 via-white/10 to-transparent"
          style={{ top: compact ? '52%' : '54%' }}/>

        {/* Player name + category */}
        <div className="absolute left-3 right-3" style={{ top: compact ? '55%' : '57%' }}>
          <div className={`font-black font-condensed text-white truncate ${compact ? 'text-sm' : 'text-base'}`}
            style={{ textShadow: '0 1px 8px rgba(0,0,0,0.8)' }}>
            {player.full_name.toUpperCase()}
          </div>
          <div className="text-teal-400/70 text-[9px] font-semibold">{player.category}</div>
        </div>

        {/* Stats */}
        <div className="absolute left-3 right-3 bottom-3 space-y-1">
          {hasStats ? (
            STAT_LABELS.map(({ key, label }) => (
              <StatBar key={key} label={label} value={(stats as any)[key]}/>
            ))
          ) : (
            <div className="text-center text-white/20 text-xs py-2">No ratings yet</div>
          )}
        </div>

        {/* Season watermark */}
        <div className="absolute bottom-3 right-3 text-white/10 text-[8px] font-bold">
          {new Date().getFullYear()}/{new Date().getFullYear() + 1}
        </div>
      </div>

      {/* Download button */}
      {showDownload && (
        <button onClick={downloadCard} className="btn-secondary flex items-center gap-2 text-sm py-2 px-4">
          <Download size={15}/> Download Card
        </button>
      )}

      {/* Player ID */}
      <div className="text-white/20 text-xs font-mono">{player.player_code}</div>
    </div>
  )
}
