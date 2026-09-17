'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import { LogOut, ChevronRight } from 'lucide-react'
import { coachNav, adminOnlyNav, parentNav, playerNav } from '@/lib/navItems'

export default function Sidebar({ role, userName, permissions }: { role: string; userName: string; permissions?: string[] | null }) {
  const pathname = usePathname()
  const supabase = createClient()
  const profile = { role, permissions }
  const nav = (role === 'coach' || role === 'admin'
    ? [...coachNav, ...(role === 'admin' ? adminOnlyNav : [])]
    : role === 'parent' ? parentNav : playerNav
  ).filter(item => !item.area || hasPermission(profile, item.area))
  const [clubInfo, setClubInfo] = useState<{ logo_url?: string; name?: string }>({})

  useEffect(() => {
    supabase.from('club_settings').select('value').eq('key', 'club_info').single()
      .then(({ data }) => { if (data?.value) setClubInfo(data.value as any) })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-[#091520] border-r border-white/5 fixed left-0 top-0 z-40 overflow-hidden">
      <div className="p-5 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-400 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {clubInfo.logo_url ? (
              <img src={clubInfo.logo_url} alt="Club logo" className="w-full h-full object-contain p-1"/>
            ) : (
              <span className="text-[#0D1B2A] font-black text-xs">OPFC</span>
            )}
          </div>
          <div>
            <div className="font-bold text-white text-sm">OPFC Connect</div>
            <div className="text-white/30 text-xs capitalize">{role} Portal</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
        {nav.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/coach' && item.href !== '/parent' && item.href !== '/player' &&
             pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={cn(isActive ? 'nav-item-active' : 'nav-item', 'text-sm')}>
              <item.icon size={18}/>
              <span>{item.label}</span>
              {isActive && <ChevronRight size={14} className="ml-auto opacity-50"/>}
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-teal-400/20 border border-teal-400/30 flex items-center justify-center flex-shrink-0">
            <span className="text-teal-400 font-bold text-xs">{userName[0]?.toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium truncate">{userName}</div>
            <div className="text-white/30 text-xs capitalize">{role}</div>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2.5 w-full rounded-xl text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm">
          <LogOut size={16}/> Sign Out
        </button>
      </div>
    </aside>
  )
}
