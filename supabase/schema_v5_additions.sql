-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Schema v5 additions
-- Run in Supabase SQL Editor AFTER schema_v4_additions.sql.
-- Additive only — safe to run on the live production database, and safe
-- to re-run.
-- ══════════════════════════════════════════════════════════════

-- ── FIELD SHEETS ──────────────────────────────────────────────────
-- On-field worksheets: pick a drill name + a roster of players, define
-- your own note-taking columns (Reps, Time, Notes, whatever the drill
-- needs), fill it in like a spreadsheet from a phone/tablet at training.
-- One row per sheet; cell data lives in `data` as
--   { "<player_id>": { "<column_key>": "value", ... }, ... }
-- rather than a normalized per-cell table — plenty for a club this size
-- and keeps a fill-in save a single atomic write.
create table if not exists public.field_sheets (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  category     text,
  session_id   uuid references public.training_sessions(id) on delete set null,
  columns      jsonb not null default '[]',
  player_ids   uuid[] not null default '{}',
  data         jsonb not null default '{}',
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
alter table public.field_sheets enable row level security;
drop policy if exists "Coaches manage field sheets" on public.field_sheets;
create policy "Coaches manage field sheets" on public.field_sheets for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
drop trigger if exists field_sheets_updated_at on public.field_sheets;
create trigger field_sheets_updated_at before update on public.field_sheets
  for each row execute function update_updated_at();
