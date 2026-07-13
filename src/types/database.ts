export type UserRole = 'admin' | 'coach' | 'parent' | 'player'
export type PlayerCategory = 'U9' | 'U13' | 'First Team'
export type PlayerPosition = 'GK' | 'DEF' | 'MID' | 'FWD'
export type PaymentStatus = 'pending' | 'paid' | 'overdue'
export type AttendanceStatus = 'present' | 'absent' | 'late'
export type SessionType = 'training' | 'match' | 'tournament'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  profile_id?: string
  player_code?: string
  full_name: string
  date_of_birth: string
  category: PlayerCategory
  position: PlayerPosition
  nationality: string
  school?: string
  address?: string
  medical_notes?: string
  photo_url?: string
  qr_code?: string
  is_active: boolean
  created_at: string
  updated_at: string
  // relations
  guardian?: Guardian
  stats?: PlayerStats
  payments?: Payment[]
}

export interface Guardian {
  id: string
  player_id: string
  profile_id?: string           // linked if guardian has an account
  full_name: string
  relationship: string
  phone_primary: string
  phone_secondary?: string
  email?: string
  created_at: string
}

export interface PlayerStats {
  id: string
  player_id: string
  pac: number                   // Pace
  sho: number                   // Shooting
  pas: number                   // Passing
  dri: number                   // Dribbling
  def: number                   // Defending
  phy: number                   // Physical
  ovr: number                   // Overall (computed)
  coach_notes?: string
  attitude?: string
  assessed_month: string        // e.g. "2026-05"
  assessed_by: string           // profile_id of coach
  created_at: string
}

export interface TrainingSession {
  id: string
  title: string
  session_type: SessionType
  category: PlayerCategory | 'All'
  date: string
  time_start: string
  duration_minutes: number
  venue: string
  notes?: string
  created_by: string
  created_at: string
  // computed
  attendance_count?: number
}

export interface AttendanceRecord {
  id: string
  session_id: string
  player_id: string
  status: AttendanceStatus
  scanned_at?: string
  scanned_by?: string
  notes?: string
  // relations
  player?: Player
  session?: TrainingSession
}

export interface Payment {
  id: string
  player_id: string
  type: 'entry' | 'monthly'
  month?: string               // e.g. "2026-05" for monthly fees
  amount: number
  status: PaymentStatus
  confirmed_by?: string
  confirmed_at?: string
  notes?: string
  created_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  tag: 'Admin' | 'Event' | 'Shop' | 'General' | 'Urgent'
  target_category?: PlayerCategory | 'All'
  is_urgent: boolean
  created_by: string
  created_at: string
  expires_at?: string
}

// View types (with joins)
export interface PlayerWithDetails extends Omit<Player, 'stats'> {
  guardian: Guardian
  stats: PlayerStats | null
  latest_payment: Payment | null
  attendance_rate: number
}

export interface SessionWithAttendance extends TrainingSession {
  attendance: AttendanceRecord[]
  present_count: number
  total_players: number
}
