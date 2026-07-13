-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Fixed Schema
-- Copy this ENTIRE file and paste into Supabase SQL Editor → Run
-- ══════════════════════════════════════════════════════════════

-- 1. Extensions
create extension if not exists "uuid-ossp";

-- 2. PROFILES
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text not null,
  role        text not null default 'parent' check (role in ('admin','coach','parent','player')),
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Coaches/admins can read all profiles" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Coaches/admins can read all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

-- 3. PLAYERS (no guardian reference in policy yet)
create table if not exists public.players (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid references public.profiles(id),
  player_code     text unique,
  full_name       text not null,
  date_of_birth   date not null,
  category        text not null check (category in ('U9','U13','First Team')),
  position        text not null check (position in ('GK','DEF','MID','FWD')),
  nationality     text default 'Mauritian',
  school          text,
  address         text,
  medical_notes   text,
  photo_url       text,
  qr_code         text,
  is_active       boolean default true,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
alter table public.players enable row level security;
drop policy if exists "Coaches/admins can manage players" on public.players;
drop policy if exists "Players/parents can read own player" on public.players;
create policy "Coaches/admins can manage players" on public.players for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
-- Simple self-read policy (guardian policy added after guardians table exists)
create policy "Players can read own player" on public.players for select using (
  profile_id = auth.uid()
);

-- 4. Auto player code trigger
create or replace function generate_player_code() returns trigger as $$
declare next_num integer;
begin
  select coalesce(max(cast(substring(player_code from 6) as integer)), 0) + 1
  into next_num from public.players where player_code is not null;
  new.player_code := 'OPFC-' || lpad(next_num::text, 3, '0');
  return new;
end;
$$ language plpgsql;
drop trigger if exists set_player_code on public.players;
create trigger set_player_code before insert on public.players
  for each row when (new.player_code is null)
  execute function generate_player_code();

-- 5. GUARDIANS
create table if not exists public.guardians (
  id               uuid primary key default uuid_generate_v4(),
  player_id        uuid references public.players(id) on delete cascade,
  profile_id       uuid references public.profiles(id),
  full_name        text not null,
  relationship     text not null,
  phone_primary    text not null,
  phone_secondary  text,
  email            text,
  created_at       timestamptz default now()
);
alter table public.guardians enable row level security;
drop policy if exists "Coaches/admins can manage guardians" on public.guardians;
drop policy if exists "Guardians can read own record" on public.guardians;
create policy "Coaches/admins can manage guardians" on public.guardians for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Guardians can read own record" on public.guardians for select using (profile_id = auth.uid());

-- 6. Now add guardian-aware policy to players
drop policy if exists "Parents can read linked player" on public.players;
create policy "Parents can read linked player" on public.players for select using (
  exists (select 1 from public.guardians g where g.player_id = players.id and g.profile_id = auth.uid())
);

-- 7. PLAYER STATS
create table if not exists public.player_stats (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid references public.players(id) on delete cascade,
  pac             integer not null default 50 check (pac between 1 and 99),
  sho             integer not null default 50 check (sho between 1 and 99),
  pas             integer not null default 50 check (pas between 1 and 99),
  dri             integer not null default 50 check (dri between 1 and 99),
  def             integer not null default 50 check (def between 1 and 99),
  phy             integer not null default 50 check (phy between 1 and 99),
  ovr             integer generated always as (round((pac+sho+pas+dri+def+phy)::numeric/6)) stored,
  coach_notes     text,
  attitude        text,
  assessed_month  text not null,
  assessed_by     uuid references public.profiles(id),
  created_at      timestamptz default now(),
  unique(player_id, assessed_month)
);
alter table public.player_stats enable row level security;
drop policy if exists "Coaches/admins can manage stats" on public.player_stats;
drop policy if exists "Players/parents can read own stats" on public.player_stats;
create policy "Coaches/admins can manage stats" on public.player_stats for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents can read own stats" on public.player_stats for select using (
  exists (select 1 from public.players pl
    where pl.id = player_stats.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- 8. TRAINING SESSIONS
create table if not exists public.training_sessions (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  session_type     text not null check (session_type in ('training','match','tournament')),
  category         text not null default 'All',
  date             date not null,
  time_start       time not null,
  duration_minutes integer default 90,
  venue            text not null default 'Morcellement Raffray Football Ground',
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now()
);
alter table public.training_sessions enable row level security;
drop policy if exists "Coaches/admins can manage sessions" on public.training_sessions;
drop policy if exists "All authenticated users can read sessions" on public.training_sessions;
create policy "Coaches/admins can manage sessions" on public.training_sessions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All authenticated users can read sessions" on public.training_sessions for select using (auth.uid() is not null);

-- 9. ATTENDANCE
create table if not exists public.attendance (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid references public.training_sessions(id) on delete cascade,
  player_id   uuid references public.players(id) on delete cascade,
  status      text not null default 'present' check (status in ('present','absent','late')),
  scanned_at  timestamptz,
  scanned_by  uuid references public.profiles(id),
  notes       text,
  unique(session_id, player_id)
);
alter table public.attendance enable row level security;
drop policy if exists "Coaches/admins can manage attendance" on public.attendance;
drop policy if exists "Players/parents can read own attendance" on public.attendance;
create policy "Coaches/admins can manage attendance" on public.attendance for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents can read own attendance" on public.attendance for select using (
  exists (select 1 from public.players pl
    where pl.id = attendance.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- 10. PAYMENTS
create table if not exists public.payments (
  id            uuid primary key default uuid_generate_v4(),
  player_id     uuid references public.players(id) on delete cascade,
  type          text not null check (type in ('entry','monthly')),
  month         text,
  amount        integer not null,
  status        text not null default 'pending' check (status in ('pending','paid','overdue')),
  confirmed_by  uuid references public.profiles(id),
  confirmed_at  timestamptz,
  notes         text,
  created_at    timestamptz default now()
);
alter table public.payments enable row level security;
drop policy if exists "Coaches/admins can manage payments" on public.payments;
drop policy if exists "Players/parents can read own payments" on public.payments;
create policy "Coaches/admins can manage payments" on public.payments for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents can read own payments" on public.payments for select using (
  exists (select 1 from public.players pl
    where pl.id = payments.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- 11. ANNOUNCEMENTS
create table if not exists public.announcements (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  body             text not null,
  tag              text not null check (tag in ('Admin','Event','Shop','General','Urgent')),
  target_category  text default 'All',
  is_urgent        boolean default false,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now(),
  expires_at       timestamptz
);
alter table public.announcements enable row level security;
drop policy if exists "Coaches/admins can manage announcements" on public.announcements;
drop policy if exists "All authenticated users can read announcements" on public.announcements;
create policy "Coaches/admins can manage announcements" on public.announcements for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All authenticated users can read announcements" on public.announcements for select using (auth.uid() is not null);

-- 12. TRIGGERS
create or replace function update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists players_updated_at on public.players;
drop trigger if exists profiles_updated_at on public.profiles;
create trigger players_updated_at before update on public.players
  for each row execute function update_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at();

-- 13. AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'parent'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 14. STORAGE
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can view avatars" on storage.objects;
drop policy if exists "Coaches can upload avatars" on storage.objects;
drop policy if exists "Coaches can update avatars" on storage.objects;
create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Coaches can upload avatars" on storage.objects for insert with check (
  bucket_id = 'avatars' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Coaches can update avatars" on storage.objects for update using (
  bucket_id = 'avatars' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

-- ✅ Done! Now create your account in the app, then run:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your@email.com';

-- ── CLUB SETTINGS ─────────────────────────────────────────────
create table if not exists public.club_settings (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  value       jsonb not null,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz default now()
);
alter table public.club_settings enable row level security;
drop policy if exists "Coaches can manage settings" on public.club_settings;
drop policy if exists "All can read settings" on public.club_settings;
create policy "Coaches can manage settings" on public.club_settings for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All can read settings" on public.club_settings for select using (auth.uid() is not null);

-- Default settings
insert into public.club_settings (key, value) values
  ('categories', '["U9","U13","First Team"]'::jsonb),
  ('fees', '{"entry": 300, "monthly": {"U9": 200, "U13": 200, "First Team": 200}}'::jsonb),
  ('club_info', '{"name": "Oasis Pailles Football Club", "motto": "Omnis Tactus, Officium", "location": "Morcellement Raffray, Pailles", "logo_url": ""}'::jsonb)
on conflict (key) do nothing;

-- ── SESSION STATUS ─────────────────────────────────────────────
alter table public.training_sessions add column if not exists status text default 'upcoming' check (status in ('upcoming','done','cancelled'));

-- ── FAN CARD PREFERENCES (parent fills in) ────────────────────
create table if not exists public.fan_card (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid unique references public.players(id) on delete cascade,
  fav_club        text,        -- e.g. "Manchester United"
  fav_club_short  text,        -- e.g. "MUFC"
  fav_intl_team   text,        -- e.g. "France"
  fav_intl_code   text,        -- e.g. "FRA"
  idol_name       text,        -- e.g. "Ronaldo"
  idol_number     integer,     -- e.g. 7
  nickname        text,        -- player's own nickname
  updated_at      timestamptz default now()
);
alter table public.fan_card enable row level security;
create policy "Coaches can manage fan cards" on public.fan_card for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Parents can manage own fan card" on public.fan_card for all using (
  exists (select 1 from public.guardians g where g.player_id = fan_card.player_id and g.profile_id = auth.uid())
);
create policy "All authenticated can read fan cards" on public.fan_card for select using (auth.uid() is not null);
