'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Trophy, Medal, Gift } from 'lucide-react'

export default function Leaderboard({ highlightPlayerId }: { highlightPlayerId?: string }) {
  const supabase = createClient()
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCat, setSelectedCat] = useState('All')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [globalAwards, setGlobalAwards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [selectedCat])

  async function loadCategories() {
    const { data } = await supabase.from('club_settings').select('value').eq('key', 'categories').single()
    const cats = (data?.value as string[]) ?? []
    setCategories(['All', ...cats])
  }

  async function loadLeaderboard() {
    setLoading(true)

    // Get players in category
    let playerQuery = supabase.from('players').select('id, full_name, player_code, photo_url, category').eq('is_active', true)
    if (selectedCat !== 'All') playerQuery = playerQuery.eq('category', selectedCat)
    const { data: players } = await playerQuery.order('full_name')

    if (!players?.length) { setLeaderboard([]); setLoading(false); return }

    const playerIds = players.map(p => p.id)

    // Get individual points
    const { data: points } = await supabase
      .from('player_points')
      .select('player_id, points')
      .in('player_id', playerIds)

    // Get global awards that apply to this category
    const { data: globals } = await supabase
      .from('global_awards')
      .select('*')
      .overlaps('target_category', selectedCat === 'All' ? ['All'] : ['All', selectedCat])

    setGlobalAwards(globals ?? [])

    // Calculate totals
    const pointMap: Record<string, number> = {}
    players.forEach(p => { pointMap[p.id] = 0 })
    points?.forEach(p => { pointMap[p.player_id] = (pointMap[p.player_id] ?? 0) + p.points })

    // Add global award points to all players in category
    const globalTotal = (globals ?? []).reduce((sum, g) => sum + g.points, 0)
    players.forEach(p => { pointMap[p.id] = (pointMap[p.id] ?? 0) + globalTotal })

    const ranked = players
      .map(p => ({ ...p, total: pointMap[p.id] ?? 0 }))
      .sort((a, b) => b.total - a.total)

    setLeaderboard(ranked)
    setLoading(false)
  }

  const rankIcon = (i: number) => {
    if (i === 0) return <Trophy size={20} className="text-amber-400"/>
    if (i === 1) return <Medal size={20} className="text-gray-400"/>
    if (i === 2) return <Medal size={20} className="text-orange-600"/>
    return <span className="text-white/30 font-bold text-sm w-5 text-center">{i + 1}</span>
  }

  const rankBg = (i: number) => {
    if (i === 0) return 'border-amber-400/30 bg-amber-400/5'
    if (i === 1) return 'border-white/20 bg-white/3'
    if (i === 2) return 'border-orange-600/30 bg-orange-600/5'
    return 'border-white/5'
  }

  return (
    <div>
      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-6">
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCat(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all
              ${selectedCat === cat ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Global awards banner */}
      {globalAwards.length > 0 && (
        <div className="card p-4 mb-6 border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-2 mb-2">
            <Gift size={16} className="text-purple-400"/>
            <span className="text-purple-400 text-xs font-bold">GLOBAL AWARDS INCLUDED</span>
          </div>
          <div className="space-y-1">
            {globalAwards.map(g => (
              <div key={g.id} className="flex items-center justify-between text-sm">
                <span className="text-white/60">{g.title}</span>
                <span className="text-purple-400 font-bold">+{g.points} pts</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-white/30 gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="card p-12 text-center text-white/30">
          <Trophy size={40} className="mx-auto mb-3 opacity-30"/>
          <p>No players in this category yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((player, i) => (
            <div key={player.id} className={`card p-4 flex items-center gap-4 border ${rankBg(i)} ${player.id === highlightPlayerId ? 'ring-2 ring-teal-400/50' : ''}`}>
              <div className="w-8 flex items-center justify-center flex-shrink-0">
                {rankIcon(i)}
              </div>
              <div className="w-10 h-10 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {player.photo_url
                  ? <img src={player.photo_url} className="w-full h-full object-cover" alt=""/>
                  : <span className="text-teal-400 font-bold text-sm">{player.full_name[0]}</span>
                }
              </div>
              <div className="flex-1">
                <p className="text-white font-bold">
                  {player.full_name}{player.id === highlightPlayerId && <span className="text-teal-400 text-xs font-semibold ml-2">YOU</span>}
                </p>
                <p className="text-white/30 text-xs">{player.category} · {player.player_code}</p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-black font-condensed ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-orange-500' : 'text-teal-400'}`}>
                  {player.total}
                </div>
                <div className="text-white/30 text-xs">pts</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
