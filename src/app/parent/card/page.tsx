'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PassCardFront, PassCardBack } from '@/components/cards/PassCard'
import FanCard from '@/components/cards/FanCard'
import { formatDate, getAge } from '@/lib/utils'

export default function ParentCardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: guardian } = await supabase
        .from('guardians')
        .select('*, player:players(*, stats:player_stats(*))')
        .eq('profile_id', user.id)
        .single()

      const player = guardian?.player as any
      if (!player) { setLoading(false); return }

      const { data: fanCard } = await supabase
        .from('fan_card')
        .select('*')
        .eq('player_id', player.id)
        .single()

      setData({ player, fanCard: fanCard ?? {} })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0D1B2A' }}>
      <div style={{ color: 'rgba(255,255,255,0.4)' }}>Loading…</div>
    </div>
  )

  if (!data?.player) return (
    <div className="p-8 text-center text-white/30">No player linked. Contact your coach.</div>
  )

  const { player, fanCard } = data

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <h1 className="page-title mb-1">Player Cards</h1>
      <p className="text-white/30 text-sm mb-8">Two cards for {player.full_name}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Club Pass Card */}
        <div>
          <div className="mb-4">
            <h2 className="text-white font-bold text-base">Club Pass Card</h2>
            <p className="text-white/30 text-xs mt-0.5">Official club card — print double-sided and laminate</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div>
              <p className="section-title mb-2 text-center text-xs">FRONT</p>
              <PassCardFront player={player}/>
            </div>
            <div>
              <p className="section-title mb-2 text-center text-xs">BACK (QR — coach will share)</p>
              <PassCardBack player={player}/>
            </div>
            <p className="text-white/20 text-xs text-center">The QR back card is available from your coach after registration confirmation</p>
          </div>
        </div>

        {/* Fan Card */}
        <div>
          <div className="mb-4">
            <h2 className="text-white font-bold text-base">Fan Card ⚽</h2>
            <p className="text-white/30 text-xs mt-0.5">Personalise with your child's favourite club and idol</p>
          </div>
          <FanCard
            player={player}
            data={fanCard}
            canEdit={true}
          />
        </div>
      </div>

      {/* Player info */}
      <div className="card p-5 mt-8">
        <h2 className="section-title mb-4">Player Info</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            ['Full Name', player.full_name],
            ['Date of Birth', formatDate(player.date_of_birth)],
            ['Age', `${getAge(player.date_of_birth)} years`],
            ['Category', player.category],
            ['Nationality', player.nationality],
            ['Player Code', player.player_code],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
              <span className="text-white/40 text-sm">{label}</span>
              <span className="text-white text-sm font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

