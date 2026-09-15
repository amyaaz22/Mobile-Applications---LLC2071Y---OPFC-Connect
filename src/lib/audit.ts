import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction = 'create' | 'update' | 'delete' | 'invite' | 'award' | 'promote' | 'demote'
export type AuditEntity =
  | 'player' | 'session' | 'field_sheet' | 'announcement'
  | 'point_rule' | 'player_points' | 'global_award'
  | 'payment' | 'expense' | 'income' | 'inventory_item'
  | 'settings' | 'staff' | 'account'

// Fire-and-forget: records one row in audit_log for the Super Admin panel.
// Never throws or blocks the calling action — a logging failure (e.g. a
// pending v7 migration) must never break the actual feature.
export async function logAudit(
  supabase: SupabaseClient,
  entry: { action: AuditAction; entity: AuditEntity; entity_id?: string | null; summary: string; metadata?: Record<string, unknown> }
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single()
    await supabase.from('audit_log').insert({
      actor_id: user.id,
      actor_name: profile?.full_name ?? null,
      actor_role: profile?.role ?? null,
      action: entry.action,
      entity: entry.entity,
      entity_id: entry.entity_id ?? null,
      summary: entry.summary,
      metadata: entry.metadata ?? null,
    })
  } catch {
    // best-effort only
  }
}
