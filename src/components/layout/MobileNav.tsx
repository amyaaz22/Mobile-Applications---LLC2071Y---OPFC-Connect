'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Home, Users, CalendarDays, BarChart3, QrCode, CreditCard, Wallet, Megaphone } from 'lucide-react'

const coachItems = [
  { href: '/coach', label: 'Home', icon: Home },
  { href: '/coach/players', label: 'Players', icon: Users },
  { href: '/scan', label: 'Scan', icon: QrCode },
  { href: '/coach/sessions', label: 'Sessions', icon: CalendarDays },
  { href: '/coach/payments', label: 'Fees', icon: Wallet },
]

const parentItems = [
  { href: '/parent', label: 'Home', icon: Home },
  { href: '/parent/card', label: 'Card', icon: CreditCard },
  { href: '/parent/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/parent/attendance', label: 'Attendance', icon: BarChart3 },
]

const playerItems = [
  { href: '/player', label: 'Home', icon: Home },
  { href: '/player/card', label: 'My Card', icon: CreditCard },
  { href: '/player/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/player/attendance', label: 'Attendance', icon: BarChart3 },
]

export default function MobileNav({ role }: { role: string }) {
  const pathname = usePathname()
  const items = role === 'coach' || role === 'admin' ? coachItems
    : role === 'parent' ? parentItems
    : playerItems

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#091520]/95 backdrop-blur-lg border-t border-white/5">
      <div className="flex items-center justify-around px-2 py-2">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href ||
            (href !== '/coach' && href !== '/parent' && href !== '/player' && pathname.startsWith(href))
          return (
            <Link key={href} href={href}
              className={cn('flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all',
                isActive ? 'text-teal-400' : 'text-white/40 hover:text-white/70')}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5}/>
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
