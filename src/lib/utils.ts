import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, differenceInYears } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date) {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd MMM yyyy')
}

export function formatTime(time: string) {
  const [h, m] = time.split(':')
  return `${h}:${m}`
}

export function getAge(dob: string) {
  return differenceInYears(new Date(), parseISO(dob))
}

export function getCurrentMonth() {
  return format(new Date(), 'yyyy-MM')
}

export function getMonthLabel(month: string) {
  return format(parseISO(`${month}-01`), 'MMMM yyyy')
}

export function statColor(val: number) {
  if (val >= 80) return 'text-teal-400'
  if (val >= 65) return 'text-white'
  return 'text-gray-400'
}

export function statBarColor(val: number) {
  if (val >= 80) return 'bg-teal-400'
  if (val >= 65) return 'bg-blue-400'
  return 'bg-gray-500'
}

export function categoryColor(cat: string) {
  switch (cat) {
    case 'U9': return 'bg-orange-500/20 text-orange-300 border-orange-500/30'
    case 'U13': return 'bg-purple-500/20 text-purple-300 border-purple-500/30'
    case 'First Team': return 'bg-teal-500/20 text-teal-300 border-teal-500/30'
    default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30'
  }
}

export function paymentStatusColor(status: string) {
  switch (status) {
    case 'paid': return 'bg-green-500/20 text-green-300 border-green-500/30'
    case 'pending': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
    case 'overdue': return 'bg-red-500/20 text-red-300 border-red-500/30'
    default: return 'bg-gray-500/20 text-gray-300'
  }
}

export function calculateOVR(stats: { pac: number; sho: number; pas: number; dri: number; def: number; phy: number }) {
  return Math.round((stats.pac + stats.sho + stats.pas + stats.dri + stats.def + stats.phy) / 6)
}

export function monthlyFeeAmount(category: string) {
  switch (category) {
    case 'U9': return 100
    case 'U13': return 150
    case 'First Team': return 200
    default: return 150
  }
}
