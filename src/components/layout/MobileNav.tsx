'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { hasPermission } from '@/lib/permissions'
import { LogOut, Menu, X } from 'lucide-react'
import {
  coachNav, adminOnlyNav, parentNav, playerNav,
  coachPrimaryHrefs, parentPrimaryHrefs, playerPrimaryHrefs,
  type NavItem,
} from '@/lib/navItems'

export default function MobileNav({ role, userName, permissions }: { role: string; userName?: string; permissions?: string[] | null }) {
  const pathname = usePathname()
  const supabase = createClient()
  const [moreOpen, setMoreOpen] = useState(false)
  const profile = { role, permissions }

  const isCoachLike = role === 'coach' || role === 'admin'
  const fullNav: NavItem[] = (
    isCoachLike ? [...coachNav, ...(role === 'admin' ? adminOnlyNav : [])]
    : role === 'parent' ? parentNav : playerNav
  ).filter(item => !item.area || hasPermission(profile, item.area))

  const primaryHrefs = isCoachLike ? coachPrimaryHrefs : role === 'parent' ? parentPrimaryHrefs : playerPrimaryHrefs
  const primaryItems = fullNav.filter(item => primaryHrefs.includes(item.href))
  const hasMore = fullNav.length > primaryItems.length

  function isActive(href: string) {
    return pathname === href || (href !== '/coach' && href !== '/parent' && href !== '/player' && pathname.startsWith(href))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#091520]/95 backdrop-blur-lg border-t border-white/5">
        <div className="flex items-center justify-around px-2 py-2">
          {primaryItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className={cn('flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                isActive(href) ? 'text-teal-400' : 'text-white/40 hover:text-white/70')}>
              <Icon size={20} strokeWidth={isActive(href) ? 2.5 : 1.5}/>
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          ))}
          {hasMore && (
            <button onClick={() => setMoreOpen(true)}
              className={cn('flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                moreOpen ? 'text-teal-400' : 'text-white/40 hover:text-white/70')}>
              <Menu size={20} strokeWidth={moreOpen ? 2.5 : 1.5}/>
              <span className="text-[10px] font-semibold">More</span>
            </button>
          )}
        </div>
      </nav>

      {/* Full menu sheet — every page this account can reach, not just the
          quick-access bar above. Without this, most of the app (every
          coach/admin page beyond Home/Players/Scan/Payments — worse for an
          unrestricted admin, who has all 16+2 areas) was unreachable on
          mobile with no way to navigate to it at all. */}
      {hasMore && moreOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)}/>
          <div className="relative bg-[#0D1B2A] rounded-t-3xl border-t border-white/10 max-h-[80vh] flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
              <h2 className="page-title" style={{ fontSize: 20 }}>Menu</h2>
              <button onClick={() => setMoreOpen(false)} className="text-white/40 hover:text-white p-1">
                <X size={22}/>
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-4">
              <div className="grid grid-cols-3 gap-3">
                {fullNav.map(({ href, label, icon: Icon }) => (
                  <Link key={href} href={href} onClick={() => setMoreOpen(false)}
                    className={cn('flex flex-col items-center gap-2 text-center py-4 px-2 rounded-2xl border transition-all',
                      isActive(href)
                        ? 'bg-teal-400/10 border-teal-400/30 text-teal-400'
                        : 'bg-white/[0.03] border-white/5 text-white/60 hover:border-white/20 hover:text-white')}>
                    <Icon size={22} strokeWidth={isActive(href) ? 2.5 : 1.5}/>
                    <span className="text-[11px] font-semibold leading-tight">{label}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="border-t border-white/5 px-5 py-4 flex-shrink-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-teal-400/20 border border-teal-400/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-teal-400 font-bold text-xs">{userName?.[0]?.toUpperCase() ?? '?'}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-white text-sm font-medium truncate">{userName ?? role}</div>
                  <div className="text-white/30 text-xs capitalize">{role}</div>
                </div>
              </div>
              <button onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 w-full rounded-xl text-white/50 hover:text-red-400 hover:bg-red-400/10 transition-all text-sm">
                <LogOut size={16}/> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
