import type { LucideIcon } from 'lucide-react'
import {
  Users, CreditCard, CalendarDays, BarChart3, Megaphone,
  Wallet, QrCode, Home, UserCircle, Settings, TrendingUp,
  Trophy, Star, PiggyBank, Receipt, HeartHandshake, Package,
  ShieldCheck, ClipboardList, Activity
} from 'lucide-react'
import type { PermissionArea } from '@/lib/permissions'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  area?: PermissionArea
}

// Single source of truth for every role's navigation, shared by Sidebar
// (desktop, shows everything) and MobileNav (small bottom bar + "More"
// sheet) — kept in one place so the two can never drift out of sync like
// they did before (MobileNav used to hardcode its own short list and
// silently fell behind every time a new page was added, leaving most of
// the app unreachable on mobile — worst for an unrestricted admin, who
// has every area).
export const coachNav: NavItem[] = [
  { href: '/coach', label: 'Dashboard', icon: Home },
  { href: '/coach/players', label: 'Players', icon: Users, area: 'players' },
  { href: '/coach/sessions', label: 'Sessions', icon: CalendarDays, area: 'sessions' },
  { href: '/coach/drills', label: 'Field Sheets', icon: ClipboardList, area: 'field_sheets' },
  { href: '/coach/attendance', label: 'Attendance', icon: BarChart3, area: 'attendance' },
  { href: '/coach/analytics', label: 'Analytics', icon: TrendingUp, area: 'analytics' },
  { href: '/coach/leaderboard', label: 'Leaderboard', icon: Trophy, area: 'leaderboard' },
  { href: '/coach/points', label: 'Points', icon: Star, area: 'points' },
  { href: '/coach/announcements', label: 'Announcements', icon: Megaphone, area: 'announcements' },
  { href: '/coach/finance', label: 'Finance', icon: PiggyBank, area: 'finance' },
  { href: '/coach/payments', label: 'Payments', icon: Wallet, area: 'payments' },
  { href: '/coach/income', label: 'Income & Donations', icon: HeartHandshake, area: 'income' },
  { href: '/coach/expenses', label: 'Expenses', icon: Receipt, area: 'expenses' },
  { href: '/coach/inventory', label: 'Inventory', icon: Package, area: 'inventory' },
  { href: '/scan', label: 'QR Scanner', icon: QrCode },
  { href: '/coach/settings', label: 'Club Settings', icon: Settings, area: 'settings' },
  { href: '/coach/profile', label: 'Profile', icon: UserCircle },
]

export const adminOnlyNav: NavItem[] = [
  { href: '/coach/staff', label: 'Staff & Parents', icon: ShieldCheck, area: 'staff' },
  { href: '/coach/admin', label: 'Super Admin', icon: Activity, area: 'system' },
]

export const parentNav: NavItem[] = [
  { href: '/parent', label: 'Home', icon: Home },
  { href: '/parent/card', label: 'Player Card', icon: CreditCard },
  { href: '/parent/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/parent/attendance', label: 'Attendance', icon: BarChart3 },
  { href: '/parent/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/parent/statement', label: 'Statement of Account', icon: Receipt },
]

export const playerNav: NavItem[] = [
  { href: '/player', label: 'Home', icon: Home },
  { href: '/player/card', label: 'My Card', icon: CreditCard },
  { href: '/player/schedule', label: 'Schedule', icon: CalendarDays },
  { href: '/player/attendance', label: 'Attendance', icon: BarChart3 },
  { href: '/player/leaderboard', label: 'Leaderboard', icon: Trophy },
]

// Bottom-bar quick-access hrefs for coach/admin — everything else (all of
// coachNav/adminOnlyNav beyond these) lives behind the "More" sheet.
// Kept short and game-day-relevant: checking in players is the most
// time-pressured mobile action this app has.
export const coachPrimaryHrefs = ['/coach', '/coach/players', '/scan', '/coach/payments']
export const parentPrimaryHrefs = ['/parent', '/parent/card', '/parent/schedule', '/parent/attendance']
export const playerPrimaryHrefs = ['/player', '/player/card', '/player/schedule', '/player/attendance']
