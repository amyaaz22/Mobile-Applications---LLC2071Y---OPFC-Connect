-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v14 additions
-- Run in Supabase SQL Editor AFTER schema_v13_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run (every statement is a no-op once already applied).
-- ══════════════════════════════════════════════════════════════
--
-- Drill Library (phase 1 — no AI extraction yet, just the data model and
-- a manual browse/create UI). Coaches/admins build training sessions out
-- of a shared, searchable library of drills instead of reinventing them
-- each time. Later phases add: AI-assisted extraction of drills from PDF
-- coaching materials (model-agnostic — any LLM can fill the same schema),
-- and a training-programme builder that composes multiple drills into an
-- assignable session plan.
--
-- training_materials / material_chunks exist now (even though nothing
-- writes to them yet) so the schema is ready for that extraction phase
-- without another migration: material_chunks is the "x amount already
-- gone through" tracker — one row per page-range handed to a model, each
-- independently markable done, so re-running extraction never repeats a
-- chunk. drills.source_material_id/source_page_range carry provenance
-- back to whichever PDF (and page range) a drill came from, whether it
-- was entered manually or extracted.

create table if not exists public.training_materials (
  id               uuid primary key default extensions.uuid_generate_v4(),
  title            text not null,
  total_pages      integer,
  status           text not null default 'pending' check (status in ('pending','processing','done')),
  processed_pages  integer not null default 0,
  notes            text,
  created_by       uuid references public.profiles(id) on delete set null,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create table if not exists public.material_chunks (
  id                uuid primary key default extensions.uuid_generate_v4(),
  material_id       uuid not null references public.training_materials(id) on delete cascade,
  page_start        integer not null,
  page_end          integer not null,
  status            text not null default 'pending' check (status in ('pending','done')),
  drills_extracted  integer not null default 0,
  processed_at      timestamptz,
  created_at        timestamptz default now()
);

create table if not exists public.drills (
  id                   uuid primary key default extensions.uuid_generate_v4(),
  name                 text not null,
  categories           text[] default array['All']::text[],   -- same convention as point_rules.category
  tags                 text[] default array[]::text[],         -- e.g. Rondo, Possession, Finishing, Defending
  game_format          text,                                   -- small_sided_game / 1v1 / rondo / technical / conditioned_game / ...
  team_setup           jsonb,                                  -- flexible shape, e.g. {"attackers":5,"defenders":3} or {"team_a":1,"team_b":1}
  min_players          integer,
  max_players          integer,
  duration_minutes     integer,
  equipment            text[] default array[]::text[],
  field_dimensions     text,
  description          text,
  setup_instructions   text,
  coaching_points      text,
  progressions         jsonb,                                  -- array of variation strings
  source_material_id   uuid references public.training_materials(id) on delete set null,
  source_page_range    text,                                   -- e.g. "142-144", freeform since a manual entry has no page range
  status               text not null default 'published' check (status in ('draft','published')),
  created_by           uuid references public.profiles(id) on delete set null,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

alter table public.training_materials enable row level security;
alter table public.material_chunks enable row level security;
alter table public.drills enable row level security;

-- Read stays broad for any coach/admin (every coach needs to browse/assign
-- drills — this isn't information to hide between staff, same reasoning
-- as the rest of the app's RLS design). Writes require the 'drill_library'
-- permission area.
drop policy if exists "Coaches/admins can read training materials" on public.training_materials;
create policy "Coaches/admins can read training materials" on public.training_materials for select using (
  public.is_coach_or_admin()
);
drop policy if exists "Coaches with drill_library access can write training materials" on public.training_materials;
create policy "Coaches with drill_library access can write training materials" on public.training_materials for all using (
  public.has_area_permission('drill_library')
) with check (
  public.has_area_permission('drill_library')
);

drop policy if exists "Coaches/admins can read material chunks" on public.material_chunks;
create policy "Coaches/admins can read material chunks" on public.material_chunks for select using (
  public.is_coach_or_admin()
);
drop policy if exists "Coaches with drill_library access can write material chunks" on public.material_chunks;
create policy "Coaches with drill_library access can write material chunks" on public.material_chunks for all using (
  public.has_area_permission('drill_library')
) with check (
  public.has_area_permission('drill_library')
);

drop policy if exists "Coaches/admins can read drills" on public.drills;
create policy "Coaches/admins can read drills" on public.drills for select using (
  public.is_coach_or_admin()
);
drop policy if exists "Coaches with drill_library access can write drills" on public.drills;
create policy "Coaches with drill_library access can write drills" on public.drills for all using (
  public.has_area_permission('drill_library')
) with check (
  public.has_area_permission('drill_library')
);

create index if not exists material_chunks_material_id_idx on public.material_chunks(material_id);
create index if not exists material_chunks_status_idx on public.material_chunks(status);
create index if not exists drills_status_idx on public.drills(status);
create index if not exists drills_categories_idx on public.drills using gin(categories);
create index if not exists drills_tags_idx on public.drills using gin(tags);
