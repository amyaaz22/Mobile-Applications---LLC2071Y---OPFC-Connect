-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v7 additions
-- Run in Supabase SQL Editor AFTER schema_v6_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════

-- ── ACTIVITY / AUDIT LOG ──────────────────────────────────────────
-- Append-only trail of significant actions (who did what, when) for the
-- Super Admin panel. Populated from the app via src/lib/audit.ts — not
-- every single mutation is logged (e.g. individual QR attendance scans
-- already carry scanned_by/scanned_at on the attendance row itself, and
-- Field Sheet per-cell autosaves are too high-volume to be useful here).
create table if not exists public.audit_log (
  id          uuid primary key default uuid_generate_v4(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_name  text,
  actor_role  text,
  action      text not null,   -- 'create' | 'update' | 'delete' | 'invite' | 'award' | etc — free text, not enum-constrained
  entity      text not null,   -- 'player' | 'session' | 'payment' | 'expense' | 'income' | 'inventory_item' | 'announcement' | 'point_rule' | 'player_points' | 'global_award' | 'settings' | 'staff' | 'field_sheet'
  entity_id   uuid,
  summary     text not null,   -- human-readable one-liner shown in the Activity Log
  metadata    jsonb,
  created_at  timestamptz default now()
);
alter table public.audit_log enable row level security;

-- Only admins can read the log (Super Admin panel is admin-only, area 'system').
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log" on public.audit_log for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

-- Any signed-in coach/admin can append an entry (that's who performs actions).
-- No update/delete policy at all — the log is immutable from the app.
drop policy if exists "Staff append audit log" on public.audit_log;
create policy "Staff append audit log" on public.audit_log for insert with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_entity_idx on public.audit_log (entity);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id);
