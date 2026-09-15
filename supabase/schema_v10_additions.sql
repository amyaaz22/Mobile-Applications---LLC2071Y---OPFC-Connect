-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v10 additions
-- Run in Supabase SQL Editor AFTER schema_v9_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════

-- ── TRIAL-SESSION ONBOARDING ──────────────────────────────────────
-- A prospective player can be registered as 'trial' (no entry fee charged
-- yet, badged in the Players list) and attend one session to see how it
-- goes, then get converted to 'active' — which is when the entry fee is
-- actually created. Existing players all backfill to 'active' automatically
-- (column default applies to existing rows on ADD COLUMN).
alter table public.players add column if not exists enrollment_status text not null default 'active' check (enrollment_status in ('trial','active'));
