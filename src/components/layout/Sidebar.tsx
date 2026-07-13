'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { toast } from 'react-hot-toast'
import {
  Users, CreditCard, CalendarDays, BarChart3,
  Megaphone, Wallet, LogOut, QrCode, Home, ChevronRight, UserCircle, Settings
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
}

const coachNav: NavItem[] = [
  { href: '/coach', label: 'Dashboard', icon: <Home size={18}/> },
  { href: '/coach/players', label: 'Players', icon: <Users size={18}/> },
  { href: '/coach/sessions', label: 'Sessions', icon: <CalendarDays size={18}/> },
  { href: '/coach/attendance', label: 'Attendance', icon: <BarChart3 size={18}/> },
  { href: '/coach/announcements', label: 'Announcements', icon: <Megaphone size={18}/> },
  { href: '/coach/payments', label: 'Payments', icon: <Wallet size={18}/> },
  { href: '/scan', label: 'QR Scanner', icon: <QrCode size={18}/> },
  { href: '/coach/settings', label: 'Club Settings', icon: <Settings size={18}/> },
  { href: '/coach/profile', label: 'Profile', icon: <UserCircle size={18}/> },
]

const parentNav: NavItem[] = [
  { href: '/parent', label: 'Home', icon: <Home size={18}/> },
  { href: '/parent/card', label: 'Player Card', icon: <CreditCard size={18}/> },
  { href: '/parent/schedule', label: 'Schedule', icon: <CalendarDays size={18}/> },
  { href: '/parent/attendance', label: 'Attendance', icon: <BarChart3 size={18}/> },
]

const playerNav: NavItem[] = [
  { href: '/player', label: 'Home', icon: <Home size={18}/> },
  { href: '/player/card', label: 'My Card', icon: <CreditCard size={18}/> },
  { href: '/player/schedule', label: 'Schedule', icon: <CalendarDays size={18}/> },
  { href: '/player/attendance', label: 'Attendance', icon: <BarChart3 size={18}/> },
]

interface SidebarProps {
  role: string
  userName: string
}

export default function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const nav = role === 'coach' || role === 'admin' ? coachNav
    : role === 'parent' ? parentNav
    : playerNav

  async function handleLogout() {
    await supabase.auth.signOut()
    toast.success('Signed out')
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-[#091520] border-r border-white/5 fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-teal-400 flex items-center justify-center flex-shrink-0">
            <span className="text-navy-900 font-black text-xs font-condensed">OPFC</span>
          </div>
          <div>
            <div className="font-bold text-white text-sm">OPFC Connect</div>
            <div className="text-white/30 text-xs capitalize">{role} Portal</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {nav.map(item => {
          const isActive = pathname === item.href ||
            (item.href !== '/coach' && item.href !== '/parent' && item.href !== '/player' &&
             pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={cn(isActive ? 'nav-item-active' : 'nav-item', 'text-sm')}>
              {item.icon}
              <span>{item.label}</span>
              {isActive && <ChevronRight size={14} className="ml-auto opacity-50"/>}
            </Link>
          )
        })}
      </nav>

      {/* User / logout */}
      <div className="p-4 border-t border-white/5">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-teal-400/20 border border-teal-400/30 flex items-center justify-center">
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
