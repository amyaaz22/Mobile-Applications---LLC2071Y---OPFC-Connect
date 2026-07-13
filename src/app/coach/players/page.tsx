'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Player } from '@/types/database'
import { categoryColor, getAge, formatDate } from '@/lib/utils'
import { Plus, Search, Filter, Users } from 'lucide-react'
import PlayerCard from '@/components/cards/PlayerCard'

const CATEGORIES = ['All', 'U9', 'U13', 'First Team']

export default function PlayersPage() {
  const supabase = createClient()
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'list' | 'cards'>('list')

  useEffect(() => {
    async function fetchPlayers() {
      setLoading(true)
      let query = supabase
        .from('players')
        .select(`*, guardian:guardians(*), stats:player_stats(*)`)
        .eq('is_active', true)
        .order('full_name')

      if (category !== 'All') query = query.eq('category', category)
      if (search) query = query.ilike('full_name', `%${search}%`)

      const { data } = await query
      setPlayers(data?.map(p => ({
        ...p,
        stats: p.stats?.sort((a: any, b: any) => b.assessed_month.localeCompare(a.assessed_month))[0] ?? null
      })) ?? [])
      setLoading(false)
    }
    fetchPlayers()
  }, [search, category])

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="text-white/30 text-sm mt-1">{players.length} active players</p>
        </div>
        <div className="flex gap-2">
          <Link href="/coach/players/import" className="btn-secondary flex items-center gap-2 self-start text-sm">
            <span>↑</span> Import
          </Link>
          <Link href="/coach/players/new" className="btn-primary flex items-center gap-2 self-start">
            <Plus size={16}/> Add Player
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
          <input
            type="text"
            className="input pl-9"
            placeholder="Search players…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border
                ${category === cat
                  ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                  : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:border-white/20'}`}>
              {cat}
            </button>
          ))}
        </div>
        <button onClick={() => setViewMode(v => v === 'list' ? 'cards' : 'list')}
          className="btn-secondary flex items-center gap-2 text-sm">
          {viewMode === 'list' ? '🃏 Cards' : '≡ List'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-white/30">
          <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full mr-3"/>
          Loading players…
        </div>
      )}

      {/* Card view */}
      {!loading && viewMode === 'cards' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {players.map(p => (
            <Link key={p.id} href={`/coach/players/${p.id}`} className="hover:scale-105 transition-transform">
              <PlayerCard player={p} stats={p.stats} compact/>
            </Link>
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && viewMode === 'list' && (
        <div className="card overflow-hidden">
          {players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-white/30 gap-3">
              <Users size={40} className="opacity-30"/>
              <p>No players found</p>
              <Link href="/coach/players/new" className="btn-primary text-sm">Add First Player</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    {['Player', 'Category', 'Position', 'OVR', 'Age', 'Guardian', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, i) => (
                    <tr key={p.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0">
                            {p.photo_url
                              ? <img src={p.photo_url} className="w-full h-full rounded-full object-cover" alt=""/>
                              : <span className="text-teal-400 font-bold text-sm">{p.full_name[0]}</span>
                            }
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">{p.full_name}</p>
                            <p className="text-white/30 text-xs font-mono">{p.player_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`badge ${categoryColor(p.category)}`}>{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-sm">{p.position}</td>
                      <td className="px-4 py-3">
                        <span className={`text-lg font-black font-condensed ${p.stats?.ovr >= 80 ? 'text-teal-400' : 'text-white'}`}>
                          {p.stats?.ovr ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/60 text-sm">{getAge(p.date_of_birth)}</td>
                      <td className="px-4 py-3 text-white/60 text-sm">{p.guardian?.full_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Link href={`/coach/players/${p.id}`} className="text-teal-400 text-sm hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
