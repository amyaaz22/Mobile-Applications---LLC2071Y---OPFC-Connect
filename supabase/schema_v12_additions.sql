-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v12 additions
-- Run in Supabase SQL Editor AFTER schema_v11_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════
--
-- Promotes profiles.assigned_categories and profiles.permissions from a
-- UI-level convenience to a real RLS boundary (see CLAUDE.md RBAC notes —
-- this closes the TODO item "every players/sessions/payments/etc. policy
-- still grants full data access to any coach regardless of either field").
--
-- Design, after mapping every actual read/write call site across the app
-- (see the accompanying PR description for the full trace):
--   - READ access to feature tables stays broad for any signed-in
--     coach/admin. Several pages legitimately read across feature
--     boundaries (Finance reads payments+income+expenses, Analytics reads
--     attendance+players, Field Sheets reads players for its roster
--     picker, Staff & Parents' Export Contacts reads guardians) — gating
--     SELECT by permission area would break those without adding any real
--     security value, since `permissions` in this app is about *which
--     pages/actions* an account can reach, not information hiding between
--     staff.
--   - WRITE access (insert/update/delete) on each feature's own table is
--     now gated by hasPermission()'s SQL equivalent, has_area_permission().
--     This is where the real narrowed-admin/narrowed-coach gap was: a
--     restricted account could previously still mutate any table via a
--     raw API call regardless of what Sidebar/usePermissionGuard hid from
--     them in the UI (the exact class of bug schema_v11 fixed for
--     /api/staff/invite specifically, generalized here to every table).
--   - assigned_categories row-scoping applies to players, guardians (via
--     their player), training_sessions, attendance (read only — see
--     below), and announcements — the same surface useScopedCategories()
--     already narrows in the UI (Players, Sessions, Attendance, Points,
--     Announcements). Points/leaderboard tables are deliberately left
--     unscoped: the club leaderboard is documented as club-wide ranking,
--     not per-category, and scoping it would break that feature for every
--     viewer, not just the acting coach.
--   - Attendance writes (insert/update) are deliberately left fully
--     unrestricted by permission area or category: the two real write
--     paths are the QR scanner (/scan, /scan/live — intentionally
--     ungated by any permission area today) and the Sessions detail
--     register (gated by 'sessions', not 'attendance' — the dedicated
--     Attendance page is read-only analytics). Gating attendance writes
--     by a permission area that no write path actually requires today
--     would just break scanning/session management, not add security.
--   - A handful of tables have a narrow OR-fallback where one page's
--     write genuinely spans two permission areas — documented inline at
--     each one: payments insert allows a 'players'-permitted account to
--     create only the type='entry' row that player registration/import/
--     trial-conversion auto-creates; player_points delete allows a
--     'players'-permitted account to remove a one-off award from the
--     player detail page; guardians insert/update/delete allow either
--     'players' (player edit page) or 'staff' (Staff & Parents' contact
--     management) access; profiles update allows a 'players'-permitted
--     account to complete the "auto-link parent account" flow (see "How
--     Parent Linking Works"), but only ever *into* role='parent' from an
--     already-'parent' row — the protect_profile_role trigger's own
--     stricter admin-only check still independently governs every actual
--     role/permissions change, so this cannot be used to promote/demote
--     anyone.

-- ── HELPER FUNCTIONS ────────────────────────────────────────────

-- SQL equivalent of hasPermission() in src/lib/permissions.ts — keep the
-- two in sync if PERMISSION_AREAS or its ADMIN_ONLY_AREAS ever change.
create or replace function public.has_area_permission(area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin','coach')
      and (area not in ('staff','system') or p.role = 'admin')
      and (p.permissions is null or array_length(p.permissions,1) is null or area = any(p.permissions))
  );
$$;

create or replace function public.is_coach_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin','coach')
  );
$$;

-- SQL equivalent of useScopedCategories()'s inScope(): a viewer with no
-- assigned_categories (the default) sees everything; a scoped viewer sees
-- rows in their own categories, plus anything null/'All'.
create or replace function public.in_category_scope(row_category text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        p.assigned_categories is null
        or array_length(p.assigned_categories,1) is null
        or row_category is null
        or row_category = 'All'
        or row_category = any(p.assigned_categories)
      from public.profiles p
      where p.id = auth.uid()
    ),
    true
  );
$$;

-- Same, resolved via a player_id join, for tables (guardians, attendance)
-- that don't carry their own category column.
create or replace function public.in_player_category_scope(pid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.in_category_scope((select category from public.players where id = pid));
$$;

-- ── PLAYERS ─────────────────────────────────────────────────────
drop policy if exists "Coaches/admins can manage players" on public.players;

create policy "Coaches/admins can read players" on public.players for select using (
  public.is_coach_or_admin() and public.in_category_scope(category)
);
create policy "Coaches with players access can insert players" on public.players for insert with check (
  public.has_area_permission('players') and public.in_category_scope(category)
);
create policy "Coaches with players access can update players" on public.players for update using (
  public.has_area_permission('players') and public.in_category_scope(category)
) with check (
  public.has_area_permission('players') and public.in_category_scope(category)
);
create policy "Coaches with players access can delete players" on public.players for delete using (
  public.has_area_permission('players') and public.in_category_scope(category)
);

-- ── GUARDIANS ───────────────────────────────────────────────────
-- Written from both the player edit page ('players') and Staff & Parents'
-- contact management ('staff') — see design note above.
drop policy if exists "Coaches/admins can manage guardians" on public.guardians;

create policy "Coaches/admins can read guardians" on public.guardians for select using (
  public.is_coach_or_admin() and public.in_player_category_scope(player_id)
);
create policy "Coaches can insert guardians" on public.guardians for insert with check (
  (public.has_area_permission('players') or public.has_area_permission('staff'))
  and public.in_player_category_scope(player_id)
);
create policy "Coaches can update guardians" on public.guardians for update using (
  (public.has_area_permission('players') or public.has_area_permission('staff'))
  and public.in_player_category_scope(player_id)
) with check (
  (public.has_area_permission('players') or public.has_area_permission('staff'))
  and public.in_player_category_scope(player_id)
);
create policy "Coaches can delete guardians" on public.guardians for delete using (
  (public.has_area_permission('players') or public.has_area_permission('staff'))
  and public.in_player_category_scope(player_id)
);

-- ── PLAYER STATS ────────────────────────────────────────────────
-- Not part of the documented category-scoping surface (only the player
-- detail page touches this, already 'players'-gated) — permission only.
drop policy if exists "Coaches/admins can manage stats" on public.player_stats;
create policy "Coaches with players access can manage stats" on public.player_stats for all using (
  public.has_area_permission('players')
) with check (
  public.has_area_permission('players')
);

-- ── TRAINING SESSIONS ───────────────────────────────────────────
drop policy if exists "All authenticated users can read sessions" on public.training_sessions;
create policy "All authenticated users can read sessions" on public.training_sessions for select using (
  auth.uid() is not null and public.in_category_scope(category)
);

drop policy if exists "Coaches/admins can manage sessions" on public.training_sessions;
create policy "Coaches with sessions access can insert sessions" on public.training_sessions for insert with check (
  public.has_area_permission('sessions') and public.in_category_scope(category)
);
create policy "Coaches with sessions access can update sessions" on public.training_sessions for update using (
  public.has_area_permission('sessions') and public.in_category_scope(category)
) with check (
  public.has_area_permission('sessions') and public.in_category_scope(category)
);
create policy "Coaches with sessions access can delete sessions" on public.training_sessions for delete using (
  public.has_area_permission('sessions') and public.in_category_scope(category)
);
-- "Anyone can read by scan token" is untouched — the live scanner link is
-- intentionally public to whoever holds the token/URL, coach scope or not.

-- ── ATTENDANCE ──────────────────────────────────────────────────
-- Read is category-scoped (matches the Attendance page's own UI
-- filtering); writes stay unrestricted by area/category — see design
-- note above (scanning and the Sessions-detail register both need to
-- work regardless of the acting coach's own category scope or which
-- specific permission area they hold).
drop policy if exists "Coaches/admins can manage attendance" on public.attendance;

create policy "Coaches/admins can read attendance" on public.attendance for select using (
  public.is_coach_or_admin() and public.in_player_category_scope(player_id)
);
create policy "Coaches/admins can update attendance" on public.attendance for update using (
  public.is_coach_or_admin()
) with check (
  public.is_coach_or_admin()
);
create policy "Coaches/admins can delete attendance" on public.attendance for delete using (
  public.is_coach_or_admin()
);
-- "Anyone can insert attendance" and "Players/parents can read own
-- attendance" are untouched.

-- ── FIELD SHEETS ────────────────────────────────────────────────
drop policy if exists "Coaches manage field sheets" on public.field_sheets;
create policy "Coaches/admins can read field sheets" on public.field_sheets for select using (
  public.is_coach_or_admin()
);
create policy "Coaches with field_sheets access can insert field sheets" on public.field_sheets for insert with check (
  public.has_area_permission('field_sheets')
);
create policy "Coaches with field_sheets access can update field sheets" on public.field_sheets for update using (
  public.has_area_permission('field_sheets')
) with check (
  public.has_area_permission('field_sheets')
);
create policy "Coaches with field_sheets access can delete field sheets" on public.field_sheets for delete using (
  public.has_area_permission('field_sheets')
);

-- ── POINTS (rules, awards, global awards) ──────────────────────
-- Broad "all can read" policies (leaderboard support) stay untouched —
-- the leaderboard is club-wide by design, not category-scoped.
drop policy if exists "Coaches manage point rules" on public.point_rules;
create policy "Coaches with points access can manage point rules" on public.point_rules for all using (
  public.has_area_permission('points')
) with check (
  public.has_area_permission('points')
);

-- player_points delete also allows 'players' access: the player detail
-- page's one-off award removal (see design note above).
drop policy if exists "Coaches manage player points" on public.player_points;
create policy "Coaches with points access can insert player points" on public.player_points for insert with check (
  public.has_area_permission('points')
);
create policy "Coaches with points access can update player points" on public.player_points for update using (
  public.has_area_permission('points')
) with check (
  public.has_area_permission('points')
);
create policy "Coaches can delete player points" on public.player_points for delete using (
  public.has_area_permission('points') or public.has_area_permission('players')
);

drop policy if exists "Coaches manage global awards" on public.global_awards;
create policy "Coaches with points access can manage global awards" on public.global_awards for all using (
  public.has_area_permission('points')
) with check (
  public.has_area_permission('points')
);

-- ── ANNOUNCEMENTS ───────────────────────────────────────────────
drop policy if exists "All authenticated users can read announcements" on public.announcements;
create policy "All authenticated users can read announcements" on public.announcements for select using (
  auth.uid() is not null and public.in_category_scope(target_category)
);

drop policy if exists "Coaches/admins can manage announcements" on public.announcements;
create policy "Coaches with announcements access can insert announcements" on public.announcements for insert with check (
  public.has_area_permission('announcements') and public.in_category_scope(target_category)
);
create policy "Coaches with announcements access can update announcements" on public.announcements for update using (
  public.has_area_permission('announcements') and public.in_category_scope(target_category)
) with check (
  public.has_area_permission('announcements') and public.in_category_scope(target_category)
);
create policy "Coaches with announcements access can delete announcements" on public.announcements for delete using (
  public.has_area_permission('announcements') and public.in_category_scope(target_category)
);

-- ── PAYMENTS ────────────────────────────────────────────────────
-- Insert also allows a 'players'-permitted account to create only the
-- type='entry' row that player registration/import/trial-conversion
-- auto-creates — see design note above.
drop policy if exists "Coaches/admins can manage payments" on public.payments;

create policy "Coaches/admins can read payments" on public.payments for select using (
  public.is_coach_or_admin()
);
create policy "Coaches can insert payments" on public.payments for insert with check (
  public.has_area_permission('payments')
  or (public.has_area_permission('players') and type = 'entry')
);
create policy "Coaches with payments access can update payments" on public.payments for update using (
  public.has_area_permission('payments')
) with check (
  public.has_area_permission('payments')
);
create policy "Coaches with payments access can delete payments" on public.payments for delete using (
  public.has_area_permission('payments')
);

-- ── INCOME ──────────────────────────────────────────────────────
drop policy if exists "Coaches manage income" on public.income;
create policy "Coaches/admins can read income" on public.income for select using (
  public.is_coach_or_admin()
);
create policy "Coaches with income access can insert income" on public.income for insert with check (
  public.has_area_permission('income')
);
create policy "Coaches with income access can update income" on public.income for update using (
  public.has_area_permission('income')
) with check (
  public.has_area_permission('income')
);
create policy "Coaches with income access can delete income" on public.income for delete using (
  public.has_area_permission('income')
);

-- ── EXPENSES ────────────────────────────────────────────────────
drop policy if exists "Coaches manage expenses" on public.expenses;
create policy "Coaches/admins can read expenses" on public.expenses for select using (
  public.is_coach_or_admin()
);
create policy "Coaches with expenses access can insert expenses" on public.expenses for insert with check (
  public.has_area_permission('expenses')
);
create policy "Coaches with expenses access can update expenses" on public.expenses for update using (
  public.has_area_permission('expenses')
) with check (
  public.has_area_permission('expenses')
);
create policy "Coaches with expenses access can delete expenses" on public.expenses for delete using (
  public.has_area_permission('expenses')
);

-- ── INVENTORY ───────────────────────────────────────────────────
drop policy if exists "Coaches manage inventory" on public.inventory_items;
create policy "Coaches/admins can read inventory" on public.inventory_items for select using (
  public.is_coach_or_admin()
);
create policy "Coaches with inventory access can insert inventory" on public.inventory_items for insert with check (
  public.has_area_permission('inventory')
);
create policy "Coaches with inventory access can update inventory" on public.inventory_items for update using (
  public.has_area_permission('inventory')
) with check (
  public.has_area_permission('inventory')
);
create policy "Coaches with inventory access can delete inventory" on public.inventory_items for delete using (
  public.has_area_permission('inventory')
);

-- ── CLUB SETTINGS ───────────────────────────────────────────────
-- Broad "all read settings" policy stays untouched — categories/fees/
-- club_info are used app-wide by every role, not just coaches.
drop policy if exists "Coaches manage settings" on public.club_settings;
create policy "Coaches with settings access can insert settings" on public.club_settings for insert with check (
  public.has_area_permission('settings')
);
create policy "Coaches with settings access can update settings" on public.club_settings for update using (
  public.has_area_permission('settings')
) with check (
  public.has_area_permission('settings')
);
create policy "Coaches with settings access can delete settings" on public.club_settings for delete using (
  public.has_area_permission('settings')
);

-- ── AUDIT LOG ───────────────────────────────────────────────────
-- 'system' is hard admin-only in has_area_permission() by construction
-- (it's in the staff/system exclusion list), so this is strictly tighter
-- than the old role='admin' check: a narrowed admin without 'system' in
-- their permissions can no longer read the log either.
drop policy if exists "Admins read audit log" on public.audit_log;
create policy "Admins read audit log" on public.audit_log for select using (
  public.has_area_permission('system')
);
-- "Staff append audit log" is untouched — logging is a side effect of
-- actions already gated at their own table, not a page of its own.

-- ── PROFILES ────────────────────────────────────────────────────
-- Replaces the old admin-only "Admins manage all profiles" with:
--   - any 'staff'-permitted account (admin-only by construction, same as
--     today) manages any profile, as before;
--   - a 'players'-permitted account (i.e. most coaches, by default) may
--     additionally update a profile whose role is already 'parent' — and
--     only keep it 'parent' — completing the "auto-link parent account"
--     step of player registration/edit (see "How Parent Linking Works").
--     The protect_profile_role trigger's own admin-only check still
--     independently guards every real role/permissions change, so this
--     narrow allowance can never be used to promote or demote anyone.
drop policy if exists "Admins manage all profiles" on public.profiles;
create policy "Staff/players-permitted accounts manage other profiles" on public.profiles for update using (
  public.has_area_permission('staff')
  or (public.has_area_permission('players') and role = 'parent')
) with check (
  public.has_area_permission('staff')
  or (public.has_area_permission('players') and role = 'parent')
);
