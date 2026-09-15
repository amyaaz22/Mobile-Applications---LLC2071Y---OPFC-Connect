-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v8 additions
-- Run in Supabase SQL Editor AFTER schema_v7_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════

-- ── INCOME: optional link to the donating parent's account ───────
-- Lets a donation/sponsorship recorded by a coach show up on that
-- parent's Statement of Account (/parent/statement). Optional — most
-- income (sponsorships, fundraisers, grants) has no linked parent at all.
alter table public.income add column if not exists donor_profile_id uuid references public.profiles(id) on delete set null;
