-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v13 additions
-- Run in Supabase SQL Editor AFTER schema_v12_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════
--
-- Public self-service player registration (replaces the club's Google
-- Form). A parent fills in /apply without logging in — one guardian
-- section plus one or more repeated child sections, so a parent with
-- three children fills the form once instead of three times. Submissions
-- land here, NOT directly in players/guardians — a coach/admin reviews,
-- edits if needed, and approves or rejects each child individually from
-- /coach/registrations (area 'registrations') before it becomes a real
-- player. Approving creates the players + guardians rows the same way
-- the existing "Register New Player" flow does (entry fee auto-created
-- unless flagged as a trial).

create table if not exists public.player_applications (
  id               uuid primary key default uuid_generate_v4(),
  guardian_name    text not null,
  relationship     text not null default 'Parent',
  phone_primary    text not null,
  phone_secondary  text,
  email            text,
  address_line1    text,
  address_line2    text,
  submitted_at     timestamptz default now()
);

create table if not exists public.player_application_children (
  id                  uuid primary key default uuid_generate_v4(),
  application_id      uuid not null references public.player_applications(id) on delete cascade,
  full_name           text not null,
  date_of_birth       date not null,
  school_grade        text,
  medical_conditions  text,
  takes_medication    text,
  status              text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by         uuid references public.profiles(id) on delete set null,
  reviewed_at         timestamptz,
  review_note         text,
  resolved_player_id  uuid references public.players(id) on delete set null,
  created_at          timestamptz default now()
);

alter table public.player_applications enable row level security;
alter table public.player_application_children enable row level security;

-- Public submission — no TO clause, so this applies to every role
-- including anon, same pattern as "Anyone can insert attendance". No
-- public read/update/delete at all: a parent can't see or edit their
-- submission afterward, matching the one-way flow the Google Form had.
drop policy if exists "Anyone can submit an application" on public.player_applications;
create policy "Anyone can submit an application" on public.player_applications for insert with check (true);

drop policy if exists "Anyone can submit application children" on public.player_application_children;
create policy "Anyone can submit application children" on public.player_application_children for insert with check (true);

-- Read stays broad for any coach/admin (consistent with the players/
-- guardians pattern from schema v12); writes require the 'registrations'
-- permission area.
drop policy if exists "Coaches/admins can read applications" on public.player_applications;
create policy "Coaches/admins can read applications" on public.player_applications for select using (
  public.is_coach_or_admin()
);
drop policy if exists "Coaches with registrations access can delete applications" on public.player_applications;
create policy "Coaches with registrations access can delete applications" on public.player_applications for delete using (
  public.has_area_permission('registrations')
);

drop policy if exists "Coaches/admins can read application children" on public.player_application_children;
create policy "Coaches/admins can read application children" on public.player_application_children for select using (
  public.is_coach_or_admin()
);
drop policy if exists "Coaches with registrations access can update children" on public.player_application_children;
create policy "Coaches with registrations access can update children" on public.player_application_children for update using (
  public.has_area_permission('registrations')
) with check (
  public.has_area_permission('registrations')
);
drop policy if exists "Coaches with registrations access can delete children" on public.player_application_children;
create policy "Coaches with registrations access can delete children" on public.player_application_children for delete using (
  public.has_area_permission('registrations')
);

create index if not exists player_application_children_application_id_idx on public.player_application_children(application_id);
create index if not exists player_application_children_status_idx on public.player_application_children(status);
