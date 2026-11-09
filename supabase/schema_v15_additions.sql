-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v15 additions
-- Run in Supabase SQL Editor AFTER schema_v14_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════
--
-- session_drills: the first piece of the "training programme" layer on top
-- of the Drill Library (phase 1, schema v14) — lets a coach assign drills
-- from the shared library to a specific training_session, in order, instead
-- of just browsing the library. Deliberately a thin join table, not a
-- reusable "programme template" concept yet: assigning happens straight
-- from the session a coach is actually planning (Sessions → session detail
-- → "Session Plan"), matching how the club actually runs training today. A
-- reusable template layer (e.g. a saved "U9 Monday plan" you can drop onto
-- any future session) can be layered on top of this table later without a
-- breaking change — it would just be another way to bulk-insert rows here.

create table if not exists public.session_drills (
  id          uuid primary key default extensions.uuid_generate_v4(),
  session_id  uuid not null references public.training_sessions(id) on delete cascade,
  drill_id    uuid not null references public.drills(id) on delete cascade,
  sort_order  integer not null default 0,
  notes       text,
  added_by    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now(),
  unique (session_id, drill_id)
);

alter table public.session_drills enable row level security;

-- Read stays broad for any coach/admin, same reasoning as drills itself
-- (schema v14) — this isn't information to hide between staff. Writes are
-- gated by the 'sessions' area, not 'drill_library': assigning a drill to a
-- session is part of session planning, done from the session detail page,
-- not the library itself (the same split schema v12 made for attendance
-- writes being gated by 'sessions' rather than 'attendance').
drop policy if exists "Coaches/admins can read session drills" on public.session_drills;
create policy "Coaches/admins can read session drills" on public.session_drills for select using (
  public.is_coach_or_admin()
);
drop policy if exists "Coaches with sessions access can manage session drills" on public.session_drills;
create policy "Coaches with sessions access can manage session drills" on public.session_drills for all using (
  public.has_area_permission('sessions')
) with check (
  public.has_area_permission('sessions')
);

create index if not exists session_drills_session_id_idx on public.session_drills(session_id);
create index if not exists session_drills_drill_id_idx on public.session_drills(drill_id);
