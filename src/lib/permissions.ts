// Granular admin permissions. A profile with role='admin' has full access
// unless `permissions` is set, in which case it's narrowed to just these
// areas. role='coach' is untouched by this — it keeps its existing scope.
// Enforced client-side only (matches this app's "auth is 100% client-side"
// architecture) — see CLAUDE.md RBAC notes for what that does and doesn't guarantee.
export const PERMISSION_AREAS = [
  { key: 'finance', label: 'Finance (payments, income, expenses)' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'settings', label: 'Club Settings' },
  { key: 'staff', label: 'Staff & Parents' },
] as const

export type PermissionArea = typeof PERMISSION_AREAS[number]['key']

export function hasPermission(
  profile: { role?: string | null; permissions?: string[] | null } | null | undefined,
  area: PermissionArea
): boolean {
  if (!profile) return false
  if (profile.role !== 'admin') return false
  if (!profile.permissions || profile.permissions.length === 0) return true
  return profile.permissions.includes(area)
}
