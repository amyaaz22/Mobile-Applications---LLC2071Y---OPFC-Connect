'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import PlayerCard from '@/components/cards/PlayerCard'
import { formatDate, getAge } from '@/lib/utils'

export default function PlayerCardPage() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: player } = await supabase.from('players').select('*, stats:player_stats(*)').eq('profile_id', user.id).single()
      const allStats = (player as any)?.stats?.sort((a: any, b: any) => b.assessed_month.localeCompare(a.assessed_month)) ?? []
      setData({ player, allStats, latestStats: allStats[0] ?? null })
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{background:'#0D1B2A'}}><div style={{color:'rgba(255,255,255,0.4)'}}>Loading…</div></div>
  if (!data?.player) return <div className="p-8 text-center text-white/30">No player profile linked.</div>

  const { player, allStats, latestStats } = data
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="page-title mb-6">My Card</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="flex justify-center"><PlayerCard player={player} stats={latestStats} showDownload/></div>
        <div className="space-y-5">
          <div className="card p-5">
            <h2 className="section-title mb-4">My Info</h2>
            <div className="space-y-3">
              {[['Name',player.full_name],['DOB',formatDate(player.date_of_birth)],['Age',`${getAge(player.date_of_birth)} years`],['Category',player.category],['Position',player.position],['Code',player.player_code]].map(([l,v])=>(
                <div key={l} className="flex justify-between py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-white/40 text-sm">{l}</span>
                  <span className="text-white text-sm font-medium">{v}</span>
                </div>
              ))}
            </div>
          </div>
          {latestStats && (
            <div className="card p-5">
              <h2 className="section-title mb-4">Ratings — {latestStats.assessed_month}</h2>
              {(['pac','sho','pas','dri','def','phy'] as const).map(key=>(
                <div key={key} className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold text-white/40 w-8 uppercase">{key}</span>
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${latestStats[key]>=80?'bg-teal-400':'bg-blue-400'}`} style={{width:`${latestStats[key]}%`}}/>
                  </div>
                  <span className="text-sm font-bold text-white w-6 text-right">{latestStats[key]}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-white/10 flex items-center justify-between mt-2">
                <span className="text-white/40 text-sm">Overall</span>
                <span className="text-3xl font-black font-condensed text-teal-400">{latestStats.ovr}</span>
              </div>
              {latestStats.coach_notes && <div className="mt-3 p-3 bg-teal-400/5 border border-teal-400/10 rounded-xl"><p className="text-white/40 text-xs font-bold mb-1">COACH NOTES</p><p className="text-white/70 text-sm">{latestStats.coach_notes}</p></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
