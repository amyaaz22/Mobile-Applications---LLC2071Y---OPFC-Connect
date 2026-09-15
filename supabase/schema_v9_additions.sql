-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v9 additions
-- Run in Supabase SQL Editor AFTER schema_v8_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════

-- ── SURFACE NEW SIGNUPS TO THE ADMIN ACTIVITY LOG ─────────────────
-- Self-registration via /register (and the auto-created profile on any
-- Supabase Auth signup) happens through the handle_new_user trigger, not
-- through the app's own logAudit() calls — so without this, new accounts
-- were invisible in the Super Admin Activity Log until someone noticed
-- them some other way. CREATE OR REPLACE swaps this in for the v2
-- version — no new trigger object needed.
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'parent'
  ) on conflict (id) do nothing;

  insert into public.audit_log (actor_id, actor_name, actor_role, action, entity, entity_id, summary)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'parent',
    'create',
    'account',
    new.id,
    'New account registered: ' || coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || ' (' || new.email || ')'
  );

  return new;
end;
$$ language plpgsql security definer;
