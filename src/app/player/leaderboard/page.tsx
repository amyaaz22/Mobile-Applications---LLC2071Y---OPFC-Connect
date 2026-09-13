'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy } from 'lucide-react'
import Leaderboard from '@/components/Leaderboard'

export default function PlayerLeaderboardPage() {
  const [playerId, setPlayerId] = useState<string | undefined>()

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: player } = await supabase.from('players').select('id').eq('profile_id', user.id).single()
      setPlayerId(player?.id)
    }
    load()
  }, [])

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title flex items-center gap-2"><Trophy size={28} className="text-amber-400"/> Club Leaderboard</h1>
        <p className="text-white/30 text-sm mt-1">Cumulative points — all time</p>
      </div>
      <Leaderboard highlightPlayerId={playerId}/>
    </div>
  )
}
