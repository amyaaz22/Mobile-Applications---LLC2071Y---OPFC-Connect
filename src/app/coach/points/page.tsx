'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'react-hot-toast'
import { Plus, Trash2, Star, Gift, Save, ChevronDown, ChevronUp } from 'lucide-react'

export default function PointsPage() {
  const supabase = createClient()
  const [rules, setRules] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [globalAwards, setGlobalAwards] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // New rule form
  const [newRule, setNewRule] = useState({ name: '', description: '', points: 1, icon: '⭐', category: 'All' })
  const [showRuleForm, setShowRuleForm] = useState(false)

  // Award points form
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedRule, setSelectedRule] = useState('')
  const [awardMap, setAwardMap] = useState<Record<string, boolean>>({})
  const [awarding, setAwarding] = useState(false)

  // Global award form
  const [globalForm, setGlobalForm] = useState({ title: '', description: '', points: 2, target_category: 'All' })
  const [showGlobalForm, setShowGlobalForm] = useState(false)

  const [categories, setCategories] = useState<string[]>(['All'])

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [
      { data: r },
      { data: p },
      { data: s },
      { data: g },
      { data: settings },
    ] = await Promise.all([
      supabase.from('point_rules').select('*').eq('is_active', true).order('points', { ascending: false }),
      supabase.from('players').select('id, full_name, player_code, category').eq('is_active', true).order('full_name'),
      supabase.from('training_sessions').select('*').order('date', { ascending: false }).limit(20),
      supabase.from('global_awards').select('*').order('awarded_at', { ascending: false }).limit(10),
      supabase.from('club_settings').select('value').eq('key', 'categories').single(),
    ])
    setRules(r ?? [])
    setPlayers(p ?? [])
    setSessions(s ?? [])
    setGlobalAwards(g ?? [])
    const cats = (settings?.value as any[])?.map((c: any) => c.name) ?? []
    setCategories(['All', ...cats])
    setLoading(false)
  }

  async function addRule() {
    if (!newRule.name) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('point_rules').insert({ ...newRule, created_by: user?.id })
    if (error) { toast.error('Failed to add rule'); return }
    toast.success('Rule added!')
    setNewRule({ name: '', description: '', points: 1, icon: '⭐', category: 'All' })
    setShowRuleForm(false)
    loadAll()
  }

  async function deleteRule(id: string) {
    if (!confirm('Deactivate this rule?')) return
    await supabase.from('point_rules').update({ is_active: false }).eq('id', id)
    toast.success('Rule removed')
    loadAll()
  }

  async function awardPoints() {
    if (!selectedRule) { toast.error('Select a rule'); return }
    const rule = rules.find(r => r.id === selectedRule)
    if (!rule) return

    const playerIds = Object.entries(awardMap).filter(([, v]) => v).map(([k]) => k)
    if (!playerIds.length) { toast.error('Select at least one player'); return }

    setAwarding(true)
    const { data: { user } } = await supabase.auth.getUser()
    const records = playerIds.map(pid => ({
      player_id: pid,
      rule_id: selectedRule,
      session_id: selectedSession || null,
      points: rule.points,
      awarded_by: user?.id,
    }))

    const { error } = await supabase.from('player_points').insert(records)
    if (error) { toast.error('Failed to award points'); setAwarding(false); return }
    toast.success(`${rule.points} pts awarded to ${playerIds.length} player(s)!`)
    setAwardMap({})
    setAwarding(false)
  }

  async function addGlobalAward() {
    if (!globalForm.title) return
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('global_awards').insert({ ...globalForm, awarded_by: user?.id })
    if (error) { toast.error('Failed'); return }
    toast.success('Global award given to all players!')
    setGlobalForm({ title: '', description: '', points: 2, target_category: 'All' })
    setShowGlobalForm(false)
    loadAll()
  }

  const filteredPlayers = selectedSession
    ? players.filter(p => {
        const session = sessions.find(s => s.id === selectedSession)
        return !session || session.category === 'All' || p.category === session.category
      })
    : players

  const rule = rules.find(r => r.id === selectedRule)

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <h1 className="page-title mb-2">Points System</h1>
      <p className="text-white/30 text-sm mb-8">Define rules, award points per session, and give global awards</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Rules */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Point Rules</h2>
            <button onClick={() => setShowRuleForm(!showRuleForm)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Plus size={14}/> Add Rule
            </button>
          </div>

          {showRuleForm && (
            <div className="card p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1 block">Icon</label>
                  <input className="input text-center text-xl" value={newRule.icon} onChange={e => setNewRule(n => ({ ...n, icon: e.target.value }))} maxLength={2}/>
                </div>
                <div>
                  <label className="label mb-1 block">Points</label>
                  <input type="number" className="input" value={newRule.points} onChange={e => setNewRule(n => ({ ...n, points: +e.target.value }))} min={1}/>
                </div>
              </div>
              <div>
                <label className="label mb-1 block">Rule Name *</label>
                <input className="input" placeholder="e.g. Attendance, Goal Scored" value={newRule.name} onChange={e => setNewRule(n => ({ ...n, name: e.target.value }))}/>
              </div>
              <div>
                <label className="label mb-1 block">Description</label>
                <input className="input" placeholder="Optional description" value={newRule.description} onChange={e => setNewRule(n => ({ ...n, description: e.target.value }))}/>
              </div>
              <div>
                <label className="label mb-1 block">Applies to</label>
                <select className="input" value={newRule.category} onChange={e => setNewRule(n => ({ ...n, category: e.target.value }))}>
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={addRule} className="btn-primary flex-1 text-sm">Add Rule</button>
                <button onClick={() => setShowRuleForm(false)} className="btn-secondary text-sm">Cancel</button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id} className="card p-4 flex items-center gap-3">
                <span className="text-2xl flex-shrink-0">{rule.icon}</span>
                <div className="flex-1">
                  <p className="text-white font-semibold text-sm">{rule.name}</p>
                  {rule.description && <p className="text-white/30 text-xs">{rule.description}</p>}
                  {rule.category !== 'All' && <p className="text-teal-400/60 text-xs">{rule.category} only</p>}
                </div>
                <span className="text-teal-400 font-black text-lg">+{rule.points}</span>
                <button onClick={() => deleteRule(rule.id)} className="text-white/20 hover:text-red-400 transition-colors p-1">
                  <Trash2 size={14}/>
                </button>
              </div>
            ))}
          </div>

          {/* Global awards */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title">Global Awards</h2>
              <button onClick={() => setShowGlobalForm(!showGlobalForm)} className="btn-secondary text-sm flex items-center gap-1.5">
                <Gift size={14}/> Award All
              </button>
            </div>
            <p className="text-white/30 text-xs mb-3">Give points to all players in a group at once (e.g. attending a talk)</p>

            {showGlobalForm && (
              <div className="card p-4 mb-4 space-y-3">
                <div>
                  <label className="label mb-1 block">Award Title *</label>
                  <input className="input" placeholder="e.g. Attended Coach Talk" value={globalForm.title} onChange={e => setGlobalForm(g => ({ ...g, title: e.target.value }))}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1 block">Points</label>
                    <input type="number" className="input" value={globalForm.points} onChange={e => setGlobalForm(g => ({ ...g, points: +e.target.value }))} min={1}/>
                  </div>
                  <div>
                    <label className="label mb-1 block">Group</label>
                    <select className="input" value={globalForm.target_category} onChange={e => setGlobalForm(g => ({ ...g, target_category: e.target.value }))}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={addGlobalAward} className="btn-primary flex-1 text-sm">Give Award to All</button>
                  <button onClick={() => setShowGlobalForm(false)} className="btn-secondary text-sm">Cancel</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {globalAwards.map(g => (
                <div key={g.id} className="card p-3 flex items-center gap-3 border-purple-500/20">
                  <Gift size={16} className="text-purple-400 flex-shrink-0"/>
                  <div className="flex-1">
                    <p className="text-white text-sm font-semibold">{g.title}</p>
                    <p className="text-white/30 text-xs">{g.target_category} · {new Date(g.awarded_at).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <span className="text-purple-400 font-bold">+{g.points}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Award points */}
        <div>
          <h2 className="section-title mb-3">Award Points</h2>
          <div className="card p-5 space-y-4">
            <div>
              <label className="label mb-1.5 block">Session (optional)</label>
              <select className="input" value={selectedSession} onChange={e => setSelectedSession(e.target.value)}>
                <option value="">No specific session</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {new Date(s.date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label mb-1.5 block">Point Rule *</label>
              <select className="input" value={selectedRule} onChange={e => setSelectedRule(e.target.value)}>
                <option value="">Select a rule…</option>
                {rules.map(r => (
                  <option key={r.id} value={r.id}>{r.icon} {r.name} (+{r.points} pts)</option>
                ))}
              </select>
            </div>

            {selectedRule && (
              <div className="p-3 bg-teal-400/5 border border-teal-400/10 rounded-xl">
                <p className="text-teal-400 text-xs font-bold">{rule?.icon} {rule?.name}</p>
                <p className="text-teal-400/70 text-xs mt-0.5">Awards +{rule?.points} points to each selected player</p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label">Select Players</label>
                <button onClick={() => {
                  const allSelected = filteredPlayers.every(p => awardMap[p.id])
                  const newMap: Record<string, boolean> = {}
                  filteredPlayers.forEach(p => { newMap[p.id] = !allSelected })
                  setAwardMap(newMap)
                }} className="text-teal-400 text-xs hover:underline">
                  {filteredPlayers.every(p => awardMap[p.id]) ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {filteredPlayers.map(p => (
                  <label key={p.id} className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all
                    ${awardMap[p.id] ? 'bg-teal-400/10 border border-teal-400/20' : 'hover:bg-white/5 border border-transparent'}`}>
                    <input type="checkbox" className="accent-teal-400 w-4 h-4"
                      checked={!!awardMap[p.id]}
                      onChange={e => setAwardMap(m => ({ ...m, [p.id]: e.target.checked }))}/>
                    <span className="text-white text-sm flex-1">{p.full_name}</span>
                    <span className="text-white/30 text-xs">{p.category}</span>
                  </label>
                ))}
              </div>
            </div>

            <button onClick={awardPoints} disabled={awarding || !selectedRule || !Object.values(awardMap).some(Boolean)}
              className="btn-primary w-full flex items-center justify-center gap-2">
              <Star size={16}/>
              {awarding ? 'Awarding…' : `Award Points to ${Object.values(awardMap).filter(Boolean).length} Player(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
