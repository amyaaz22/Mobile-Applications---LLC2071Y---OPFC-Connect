-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v16 additions
-- Run in Supabase SQL Editor AFTER schema_v15_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════
--
-- Two things:
--   1. A reusable "registration window" concept — an optional opens_at/
--      closes_at pair stored in club_settings, enforced as a real RLS
--      boundary (not just hidden in the UI) on any public, unauthenticated
--      insert-only form. Applied to the existing /apply (player
--      registration) form, closing the "always open, anyone can hit it any
--      time" spam surface the club flagged.
--   2. A second public form, /apply/coach, for prospective coaches to
--      submit their own details — same window control, same
--      review-before-access pattern as player registration
--      (coach_applications table + a review queue; approving invites the
--      real account via the existing /api/staff/invite route rather than
--      duplicating that logic).
--
-- Design note on the window check itself: it has to be enforced where an
-- anonymous submitter's insert is actually evaluated (RLS WITH CHECK), not
-- just read client-side to hide the form — otherwise a scripted/spam
-- submission bypassing the UI entirely would still land during a closed
-- window. club_settings itself is NOT anon-readable (its SELECT policy is
-- `auth.uid() is not null`, see schema_v2.sql) so a dedicated SECURITY
-- DEFINER helper is needed both for the RLS check and for the public pages
-- to display current open/closed status — same pattern as
-- has_area_permission()/in_category_scope() from schema_v12, but these two
-- are deliberately granted to `anon` as well as `authenticated` since an
-- unauthenticated submitter is exactly who needs to call them.

-- ── REGISTRATION WINDOW HELPERS ─────────────────────────────────

-- True when `now()` falls inside the configured window for club_settings
-- key p_key (both bounds optional; a bound of null means unrestricted on
-- that side). No row configured at all for p_key defaults to TRUE
-- (unrestricted/open) — this is what keeps /apply working exactly as
-- before for every club that hasn't touched the new Settings controls yet;
-- the window only starts restricting once an admin explicitly sets one.
create or replace function public.registration_window_open(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        (value->>'opens_at' is null or (value->>'opens_at')::timestamptz <= now())
        and (value->>'closes_at' is null or (value->>'closes_at')::timestamptz >= now())
      from public.club_settings
      where key = p_key
    ),
    true
  );
$$;

-- Same data, shaped for the public pages to render a "not open yet" /
-- "closed" message with the actual configured dates — without needing
-- broader anon read access to club_settings itself.
create or replace function public.registration_window_status(p_key text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'open', public.registration_window_open(p_key),
        'opens_at', value->>'opens_at',
        'closes_at', value->>'closes_at'
      )
      from public.club_settings
      where key = p_key
    ),
    jsonb_build_object('open', true, 'opens_at', null, 'closes_at', null)
  );
$$;

revoke execute on function public.registration_window_open(text) from public;
revoke execute on function public.registration_window_status(text) from public;
grant execute on function public.registration_window_open(text) to anon, authenticated;
grant execute on function public.registration_window_status(text) to anon, authenticated;

-- Seeded unrestricted (both bounds null) so existing behavior is
-- unchanged until an admin actually sets a window from Club Settings.
insert into public.club_settings (key, value) values
  ('player_registration', '{"opens_at": null, "closes_at": null}'::jsonb),
  ('coach_registration', '{"opens_at": null, "closes_at": null}'::jsonb)
on conflict (key) do nothing;

-- ── PLAYER REGISTRATION WINDOW ──────────────────────────────────
-- Tightens the existing public-insert policies from schema_v13 to also
-- require the window to be open. Still no `TO` clause (applies to anon
-- and authenticated alike, matching the original).
drop policy if exists "Anyone can submit an application" on public.player_applications;
create policy "Anyone can submit an application" on public.player_applications for insert with check (
  public.registration_window_open('player_registration')
);

drop policy if exists "Anyone can submit application children" on public.player_application_children;
create policy "Anyone can submit application children" on public.player_application_children for insert with check (
  public.registration_window_open('player_registration')
);

-- ── COACH APPLICATIONS (new) ────────────────────────────────────
-- Public self-service "apply to coach" form at /apply/coach — same
-- shape of flow as player registration: an anonymous submission lands
-- here, not directly in profiles, and a human reviews before any access
-- is actually granted. Approving an application doesn't create the
-- account directly from this table — it drives the *existing*
-- /api/staff/invite route (same path "Invite Coach" on Staff & Parents
-- already uses) so there is exactly one place that creates a coach auth
-- user + sets its role, not two copies of that logic to keep in sync.
create table if not exists public.coach_applications (
  id                      uuid primary key default uuid_generate_v4(),
  full_name               text not null,
  email                   text not null,
  phone                   text not null,
  date_of_birth           date,
  address                 text,
  categories_interested   text[],
  qualifications          text,
  experience              text,
  availability            text,
  motivation              text,
  status                  text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by             uuid references public.profiles(id) on delete set null,
  reviewed_at             timestamptz,
  review_note             text,
  resolved_profile_id     uuid references public.profiles(id) on delete set null,
  submitted_at            timestamptz default now()
);

alter table public.coach_applications enable row level security;

-- Public submission, gated by the coach_registration window — same
-- RETURNING gotcha as /apply applies here too (see CLAUDE.md "Player
-- Registration" notes): the SELECT policy below requires 'staff' access,
-- which an anonymous caller never has, so /apply/coach's insert must
-- generate its own id client-side and never call .select() after
-- inserting, or PostgREST's implicit RETURNING will fail the whole
-- request even though the insert itself would have succeeded.
drop policy if exists "Anyone can submit a coach application" on public.coach_applications;
create policy "Anyone can submit a coach application" on public.coach_applications for insert with check (
  public.registration_window_open('coach_registration')
);

-- Unlike player_applications (read broad for any coach/admin, since that
-- review queue is informational to the whole staff), coach_applications
-- carries a prospective hire's personal contact/availability info whose
-- only real purpose is the staff-invite decision itself — so read is
-- scoped to 'staff' here too, not just the write/approve step.
drop policy if exists "Staff-permitted accounts can read coach applications" on public.coach_applications;
create policy "Staff-permitted accounts can read coach applications" on public.coach_applications for select using (
  public.has_area_permission('staff')
);
drop policy if exists "Staff-permitted accounts can update coach applications" on public.coach_applications;
create policy "Staff-permitted accounts can update coach applications" on public.coach_applications for update using (
  public.has_area_permission('staff')
) with check (
  public.has_area_permission('staff')
);
drop policy if exists "Staff-permitted accounts can delete coach applications" on public.coach_applications;
create policy "Staff-permitted accounts can delete coach applications" on public.coach_applications for delete using (
  public.has_area_permission('staff')
);

create index if not exists coach_applications_status_idx on public.coach_applications(status);
