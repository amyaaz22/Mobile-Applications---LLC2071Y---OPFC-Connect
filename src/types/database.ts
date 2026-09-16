export type UserRole = 'admin' | 'coach' | 'parent' | 'player'
// Categories and positions are admin-configurable (Club Settings → Dropdown
// Lists) since schema v4 — no longer a fixed set of values in the DB, so
// these are widened to `string` rather than a union that would drift out of
// sync with whatever a club has actually configured.
export type PlayerCategory = string
export type PlayerPosition = string
export type PaymentStatus = 'pending' | 'paid' | 'overdue'
export type PaymentType = 'entry' | 'monthly' | 'other'
export type AttendanceStatus = 'present' | 'absent' | 'late'
export type SessionType = 'training' | 'match' | 'tournament'
export type EnrollmentStatus = 'trial' | 'active'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  // Soft coach scoping (UI convenience only, not an RLS boundary — see
  // CLAUDE.md RBAC notes): which categories' data a coach sees.
  assigned_categories?: string[] | null
  // Granular feature/page access (16 PERMISSION_AREAS, src/lib/permissions.ts).
  // Null/empty = unrestricted (default for every account).
  permissions?: string[] | null
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
  // 'trial' players skip the auto-created entry fee until converted from
  // their detail page (schema v10).
  enrollment_status: EnrollmentStatus
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
  ovr: number                   // Overall — GENERATED ALWAYS column, never include in an upsert
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
  scan_token?: string           // for the no-login live scanner (/scan/live)
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
  type: PaymentType
  month?: string               // e.g. "2026-05" for monthly fees
  amount: number
  status: PaymentStatus
  method?: string
  reference?: string           // optional freeform transaction ref (bank transfer, Juice, etc)
  confirmed_by?: string
  confirmed_at?: string
  notes?: string
  created_at: string
}

export interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number
  paid_by?: string
  receipt_url?: string         // object path in the private `receipts` bucket — view via ReceiptLink
  notes?: string
  created_by?: string
  created_at: string
}

export interface Income {
  id: string
  date: string
  source: string
  donor_name?: string
  amount: number
  category?: string
  receipt_url?: string
  // Optional link to the parent's own account so a donation shows on their
  // Statement of Account (schema v8).
  donor_profile_id?: string
  notes?: string
  created_by?: string
  created_at: string
}

export interface InventoryItem {
  id: string
  name: string
  category: string
  quantity: number
  condition?: string           // admin-configurable list since schema v4
  location?: string
  assigned_to?: string         // player id
  min_stock?: number
  notes?: string
  updated_at: string
  created_at: string
}

export interface ClubSettings {
  id: string
  key: string                  // 'categories' | 'fees' | 'club_info' | dropdown-list keys
  value: any                   // jsonb — shape depends on `key`
  updated_by?: string
  updated_at: string
}

export interface PointRule {
  id: string
  name: string
  description?: string
  points: number
  category: string[]           // e.g. ['All'] or ['U9','U13'] — array since schema v3
  icon?: string
  is_active: boolean
  created_by?: string
  created_at: string
}

export interface PlayerPoints {
  id: string
  player_id: string
  rule_id?: string              // null for a one-off custom award
  session_id?: string
  points: number
  note?: string
  awarded_by?: string
  awarded_at: string
}

export interface GlobalAward {
  id: string
  title: string
  description?: string
  points: number
  target_category: string[]     // array since schema v3
  awarded_by?: string
  awarded_at: string
}

export interface FanCard {
  id: string
  player_id: string
  fav_club?: string
  fav_club_short?: string
  fav_intl_team?: string
  fav_intl_code?: string
  idol_name?: string
  idol_number?: number
  nickname?: string
  updated_at: string
}

export interface FieldSheet {
  id: string
  title: string
  category?: string
  session_id?: string
  columns: { key: string; label: string }[]
  player_ids: string[]          // ordered roster for the sheet
  data: Record<string, Record<string, string>>  // { player_id: { col_key: value } }
  notes?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export interface Announcement {
  id: string
  title: string
  body: string
  // Admin-configurable list since schema v4 — no longer a fixed union.
  tag: string
  target_category?: PlayerCategory | 'All'
  is_urgent: boolean
  created_by: string
  created_at: string
  expires_at?: string
}

export interface AuditLogEntry {
  id: string
  actor_id?: string
  actor_name?: string
  actor_role?: string
  action: string                // 'create' | 'update' | 'delete' | 'invite' | 'promote' | 'demote' | 'award' | ... (free text)
  entity: string                // 'player' | 'session' | 'payment' | 'expense' | 'income' | 'inventory_item' | 'announcement' | 'point_rule' | 'player_points' | 'global_award' | 'settings' | 'staff' | 'field_sheet' | 'account'
  entity_id?: string
  summary: string
  metadata?: Record<string, any>
  created_at: string
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
