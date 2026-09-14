// Granular access control. A profile (role='admin' OR role='coach') has full
// access to every area unless `permissions` is set, in which case it's
// narrowed to just the listed areas. Null/empty permissions = unrestricted —
// this is the default for every existing account, so nothing changes until
// a primary admin deliberately narrows someone from the Staff page.
//
// 'staff' and 'system' are hard-locked to role==='admin' regardless of the
// permissions list — a coach can never be granted staff management or the
// Super Admin panel, narrowed or not.
//
// Enforced client-side only (matches this app's "auth is 100% client-side"
// architecture) — see CLAUDE.md RBAC notes for what that does and doesn't guarantee.
export const PERMISSION_AREAS = [
  { key: 'players', label: 'Players' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'field_sheets', label: 'Field Sheets' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'leaderboard', label: 'Leaderboard' },
  { key: 'points', label: 'Points System' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'finance', label: 'Finance Dashboard' },
  { key: 'payments', label: 'Payments' },
  { key: 'income', label: 'Income & Donations' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'settings', label: 'Club Settings' },
  { key: 'staff', label: 'Staff & Parents' },
  { key: 'system', label: 'Super Admin (accounts & activity log)' },
] as const

export type PermissionArea = typeof PERMISSION_AREAS[number]['key']

const ADMIN_ONLY_AREAS: PermissionArea[] = ['staff', 'system']

export function hasPermission(
  profile: { role?: string | null; permissions?: string[] | null } | null | undefined,
  area: PermissionArea
): boolean {
  if (!profile) return false
  if (ADMIN_ONLY_AREAS.includes(area) && profile.role !== 'admin') return false
  if (profile.role !== 'admin' && profile.role !== 'coach') return false
  if (!profile.permissions || profile.permissions.length === 0) return true
  return profile.permissions.includes(area)
}
