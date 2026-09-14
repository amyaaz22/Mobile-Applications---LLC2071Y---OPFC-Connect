'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { usePermissionGuard } from '@/hooks/usePermissionGuard'
import { Activity, Users2, Search, ShieldCheck, Clock } from 'lucide-react'

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-purple-500/15 text-purple-300 border-purple-500/25',
  coach: 'bg-teal-500/15 text-teal-300 border-teal-500/25',
  parent: 'bg-white/5 text-white/50 border-white/10',
  player: 'bg-white/5 text-white/50 border-white/10',
}

const ENTITY_LABEL: Record<string, string> = {
  player: 'Player', session: 'Session', field_sheet: 'Field Sheet', announcement: 'Announcement',
  point_rule: 'Point Rule', player_points: 'Points', global_award: 'Global Award',
  payment: 'Payment', expense: 'Expense', income: 'Income', inventory_item: 'Inventory',
  settings: 'Settings', staff: 'Staff',
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function SuperAdminPage() {
  const supabase = createClient()
  const permitted = usePermissionGuard('system')
  const [tab, setTab] = useState<'accounts' | 'log'>('accounts')

  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')

  const [logs, setLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [entityFilter, setEntityFilter] = useState('all')
  const [logLimit, setLogLimit] = useState(100)

  useEffect(() => {
    if (!permitted) return
    fetchUsers()
    fetchLogs(100)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permitted])

  useEffect(() => {
    if (permitted) fetchLogs(logLimit)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logLimit])

  async function fetchUsers() {
    setLoadingUsers(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(res.ok ? data.users ?? [] : [])
    setLoadingUsers(false)
  }

  async function fetchLogs(limit: number) {
    setLoadingLogs(true)
    const { data } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit)
    setLogs(data ?? [])
    setLoadingLogs(false)
  }

  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase()
    return users.filter(u =>
      (roleFilter === 'all' || u.role === roleFilter) &&
      (!q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
    )
  }, [users, roleFilter, search])

  const filteredLogs = useMemo(() =>
    entityFilter === 'all' ? logs : logs.filter(l => l.entity === entityFilter)
  , [logs, entityFilter])

  const entityOptions = useMemo(() => Array.from(new Set(logs.map(l => l.entity))).sort(), [logs])

  if (!permitted) return (
    <div className="flex items-center justify-center min-h-screen text-white/30">
      <div className="animate-spin w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title flex items-center gap-2"><Activity size={26} className="text-teal-400"/> Super Admin</h1>
        <p className="text-white/30 text-sm mt-1">Every account, last sign-in, and a full trail of who did what</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('accounts')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2
            ${tab === 'accounts' ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
          <Users2 size={14}/> Accounts ({users.length})
        </button>
        <button onClick={() => setTab('log')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all flex items-center gap-2
            ${tab === 'log' ? 'bg-teal-400/10 border-teal-400/30 text-teal-400' : 'border-white/10 text-white/50 hover:text-white'}`}>
          <Clock size={14}/> Activity Log
        </button>
      </div>

      {tab === 'accounts' ? (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
              <input className="input pl-8 text-sm" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)}/>
            </div>
            <select className="input w-auto text-sm" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="coach">Coach</option>
              <option value="parent">Parent</option>
              <option value="player">Player</option>
            </select>
          </div>

          <div className="card overflow-hidden">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12 text-white/30 gap-3">
                <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-white/30">No accounts found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/5">
                      {['Name', 'Role', 'Access', 'Last Sign-in', 'Joined', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-bold text-white/30 uppercase whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/2'}`}>
                        <td className="px-4 py-3">
                          <div className="text-white text-sm font-medium">{u.full_name || '—'}</div>
                          <div className="text-white/30 text-xs">{u.email}</div>
                        </td>
                        <td className="px-4 py-3"><span className={`badge text-xs ${ROLE_BADGE[u.role] ?? ROLE_BADGE.parent}`}>{u.role}</span></td>
                        <td className="px-4 py-3 text-white/50 text-xs max-w-[220px]">
                          {u.role === 'admin' || u.role === 'coach'
                            ? (u.permissions?.length ? u.permissions.join(', ') : 'Unrestricted')
                            : '—'}
                          {u.assigned_categories?.length ? <div className="text-white/30 mt-0.5">Categories: {u.assigned_categories.join(', ')}</div> : null}
                        </td>
                        <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{timeAgo(u.last_sign_in_at)}</td>
                        <td className="px-4 py-3 text-white/50 text-xs whitespace-nowrap">{u.created_at ? new Date(u.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                        <td className="px-4 py-3">
                          {!u.email_confirmed_at && <span className="badge bg-amber-500/15 text-amber-300 border-amber-500/25 text-xs">Unconfirmed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <select className="input w-auto text-sm" value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
              <option value="all">All types</option>
              {entityOptions.map(e => <option key={e} value={e}>{ENTITY_LABEL[e] ?? e}</option>)}
            </select>
          </div>

          <div className="card overflow-hidden">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-12 text-white/30 gap-3">
                <div className="animate-spin w-6 h-6 border-2 border-teal-400/30 border-t-teal-400 rounded-full"/>Loading…
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-white/30">
                <ShieldCheck size={40} className="mx-auto mb-3 opacity-30"/>
                <p>No activity recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredLogs.map(l => (
                  <div key={l.id} className="p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-teal-400 font-bold text-xs">{l.actor_name?.[0]?.toUpperCase() ?? '?'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm">{l.summary}</p>
                      <p className="text-white/30 text-xs mt-0.5">
                        {l.actor_name ?? 'Unknown'} ({l.actor_role ?? '—'}) · <span className="badge bg-white/5 text-white/40 border-white/10 text-[10px] py-0">{ENTITY_LABEL[l.entity] ?? l.entity}</span> · {timeAgo(l.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {logs.length >= logLimit && (
            <button onClick={() => setLogLimit(n => n + 100)} className="btn-secondary w-full mt-3 text-sm">
              Load more
            </button>
          )}
        </>
      )}
    </div>
  )
}
