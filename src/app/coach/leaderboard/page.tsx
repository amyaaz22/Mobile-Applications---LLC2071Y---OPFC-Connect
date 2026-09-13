'use client'
import { Trophy } from 'lucide-react'
import Leaderboard from '@/components/Leaderboard'

export default function CoachLeaderboardPage() {
  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title flex items-center gap-2"><Trophy size={28} className="text-amber-400"/> Leaderboard</h1>
        <p className="text-white/30 text-sm mt-1">Cumulative points — all time</p>
      </div>
      <Leaderboard/>
    </div>
  )
}
