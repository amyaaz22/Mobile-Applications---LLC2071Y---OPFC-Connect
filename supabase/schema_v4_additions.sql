-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v4 additions
-- Run in Supabase SQL Editor AFTER schema_v3_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════

-- ── FREE UP FIXED-ENUM COLUMNS FOR ADMIN-CONFIGURABLE LISTS ──────
-- These had CHECK constraints pinning them to the original hardcoded
-- option lists. Club Settings → Dropdown Lists now owns these lists, so
-- the DB just stores whatever text the app sends — validation of "is this
-- a real option" happens at the UI layer, the same way players.category
-- already works.
alter table public.players drop constraint if exists players_position_check;
alter table public.announcements drop constraint if exists announcements_tag_check;
alter table public.inventory_items drop constraint if exists inventory_items_condition_check;

-- ── SEED THE NEW CONFIGURABLE LISTS ──────────────────────────────
-- Matches the defaults every screen used to hardcode. Admins can edit
-- these immediately from Club Settings → Dropdown Lists; this seed just
-- means existing screens don't go blank before anyone opens that page.
insert into public.club_settings (key, value) values
  ('positions', '["GK","DEF","MID","FWD"]'::jsonb),
  ('guardian_relationships', '["Father","Mother","Uncle","Aunt","Sibling","Other"]'::jsonb),
  ('announcement_tags', '["General","Admin","Event","Shop","Urgent"]'::jsonb),
  ('payment_methods', '["Cash","Bank Transfer","Mobile Money","Other"]'::jsonb),
  ('expense_categories', '["Equipment","Referee Fees","Transport","Medical","Venue / Pitch Hire","Administration","Other"]'::jsonb),
  ('income_sources', '["Donation","Sponsorship","Fundraiser","Grant","Other"]'::jsonb),
  ('inventory_categories', '["Jerseys","Balls","Training Equipment","Goals & Nets","Medical Kit","Bibs & Cones","Other"]'::jsonb),
  ('inventory_conditions', '["New","Good","Worn","Damaged"]'::jsonb)
on conflict (key) do nothing;

-- ── GRANULAR ADMIN PERMISSIONS ────────────────────────────────────
-- role='admin' still means "full access" (checked first, everywhere) as
-- long as `permissions` is null/empty. Setting `permissions` narrows that
-- specific admin account to only the listed areas — e.g. an admin who
-- should only touch Finance, not Staff or Settings. Existing admins are
-- unaffected until someone deliberately narrows a specific account from
-- the Staff page.
-- Valid values (enforced in the app, not the DB — same pattern as
-- assigned_categories): 'players','sessions','payments','points',
-- 'finance','inventory','announcements','settings','staff'.
alter table public.profiles add column if not exists permissions text[];

-- Extend the v3 self-escalation guard to also protect `permissions`: a
-- narrowed admin (or anyone else) could otherwise grant themselves more
-- access by calling supabase.from('profiles').update({ permissions: [...] })
-- directly. Only an UNRESTRICTED admin (role='admin' AND permissions is
-- null/empty) may change either role or permissions on any row, including
-- their own. CREATE OR REPLACE swaps this in for the v3 version — no new
-- trigger needed, same trigger object.
create or replace function public.protect_profile_role() returns trigger as $$
begin
  if new.role is distinct from old.role or new.permissions is distinct from old.permissions then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
        and (p.permissions is null or array_length(p.permissions, 1) is null)
    ) then
      new.role := old.role;
      new.permissions := old.permissions;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;
