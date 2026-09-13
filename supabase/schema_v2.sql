-- ══════════════════════════════════════════════════════════════
-- OPFC Connect — Complete Schema v2
-- Run entire file in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";

-- ── PROFILES ──────────────────────────────────────────────────
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
drop policy if exists "Anyone can read profiles" on public.profiles;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Anyone can read profiles" on public.profiles for select using (auth.uid() is not null);

-- Auto-create profile on signup
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'parent'
  ) on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── CLUB SETTINGS ─────────────────────────────────────────────
create table if not exists public.club_settings (
  id          uuid primary key default uuid_generate_v4(),
  key         text unique not null,
  value       jsonb not null,
  updated_by  uuid references public.profiles(id),
  updated_at  timestamptz default now()
);
alter table public.club_settings enable row level security;
drop policy if exists "All can read settings" on public.club_settings;
drop policy if exists "Coaches can manage settings" on public.club_settings;
create policy "All can read settings" on public.club_settings for select using (auth.uid() is not null);
create policy "Coaches can manage settings" on public.club_settings for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
insert into public.club_settings (key, value) values
  ('categories', '[{"name":"Beginners","coach_id":null},{"name":"Intermediate","coach_id":null},{"name":"Advanced","coach_id":null}]'::jsonb),
  ('fees', '{"entry": 300, "monthly": {"Beginners": 200, "Intermediate": 200, "Advanced": 200}}'::jsonb),
  ('club_info', '{"name": "Oasis Pailles Football Club", "motto": "Omnis Tactus, Officium", "location": "Morcellement Raffray, Pailles", "logo_url": ""}'::jsonb)
on conflict (key) do nothing;

-- ── PLAYERS ───────────────────────────────────────────────────
create table if not exists public.players (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid references public.profiles(id),
  player_code     text unique,
  full_name       text not null,
  date_of_birth   date not null,
  category        text not null,
  position        text check (position in ('GK','DEF','MID','FWD')),
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
drop policy if exists "Players can read own player" on public.players;
drop policy if exists "Parents can read linked player" on public.players;
create policy "Coaches/admins can manage players" on public.players for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players can read own player" on public.players for select using (profile_id = auth.uid());
create policy "Parents can read linked player" on public.players for select using (
  exists (select 1 from public.guardians g where g.player_id = players.id and g.profile_id = auth.uid())
);

-- Auto player code
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

-- Updated at trigger
create or replace function update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;
drop trigger if exists players_updated_at on public.players;
create trigger players_updated_at before update on public.players
  for each row execute function update_updated_at();

-- ── GUARDIANS ─────────────────────────────────────────────────
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

-- ── PLAYER STATS ──────────────────────────────────────────────
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
create policy "Coaches manage stats" on public.player_stats for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents read own stats" on public.player_stats for select using (
  exists (select 1 from public.players pl where pl.id = player_stats.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- ── TRAINING SESSIONS ─────────────────────────────────────────
create table if not exists public.training_sessions (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  session_type     text not null check (session_type in ('training','match','tournament','event')),
  category         text not null default 'All',
  date             date not null,
  time_start       time not null,
  duration_minutes integer default 90,
  venue            text not null default 'Morcellement Raffray Football Ground',
  notes            text,
  status           text default 'upcoming' check (status in ('upcoming','done','cancelled')),
  scan_token       text unique,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now()
);
alter table public.training_sessions enable row level security;
create policy "Coaches manage sessions" on public.training_sessions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All authenticated read sessions" on public.training_sessions for select using (auth.uid() is not null);
-- Allow public scan token access (checked in API route)
create policy "Anyone can read by scan token" on public.training_sessions for select using (scan_token is not null);

-- ── ATTENDANCE ────────────────────────────────────────────────
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
create policy "Coaches manage attendance" on public.attendance for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents read own attendance" on public.attendance for select using (
  exists (select 1 from public.players pl where pl.id = attendance.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);
-- Allow unauthenticated insert for live scanner
create policy "Anyone can insert attendance" on public.attendance for insert with check (true);

-- ── PAYMENTS ──────────────────────────────────────────────────
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
create policy "Coaches manage payments" on public.payments for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents read own payments" on public.payments for select using (
  exists (select 1 from public.players pl where pl.id = payments.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────
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
create policy "Coaches manage announcements" on public.announcements for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All authenticated read announcements" on public.announcements for select using (auth.uid() is not null);

-- ── POINT RULES ───────────────────────────────────────────────
-- Coach defines what actions earn points
create table if not exists public.point_rules (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,        -- e.g. "Attendance", "Goal Scored"
  description text,
  points      integer not null default 1,
  category    text default 'All',   -- which group this applies to, or 'All'
  icon        text default '⭐',
  is_active   boolean default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz default now()
);
alter table public.point_rules enable row level security;
create policy "Coaches manage point rules" on public.point_rules for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All can read point rules" on public.point_rules for select using (auth.uid() is not null);

-- Default point rules
insert into public.point_rules (name, description, points, icon) values
  ('Attendance', 'Player attends a training session', 2, '📅'),
  ('Goal Scored', 'Player scores a goal in a match', 5, '⚽'),
  ('Man of the Match', 'Best player in a match', 10, '🏆'),
  ('Good Attitude', 'Exemplary behaviour and effort', 3, '💪'),
  ('Punctuality', 'Arrives on time to every session', 1, '⏰'),
  ('Talk/Event Attendance', 'Attends a club talk or event', 2, '🎤')
on conflict do nothing;

-- ── PLAYER POINTS ─────────────────────────────────────────────
-- Individual point awards
create table if not exists public.player_points (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid references public.players(id) on delete cascade,
  rule_id     uuid references public.point_rules(id),
  session_id  uuid references public.training_sessions(id),
  points      integer not null,
  note        text,
  awarded_by  uuid references public.profiles(id),
  awarded_at  timestamptz default now()
);
alter table public.player_points enable row level security;
create policy "Coaches manage player points" on public.player_points for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents read own points" on public.player_points for select using (
  exists (select 1 from public.players pl where pl.id = player_points.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);
create policy "All can read leaderboard points" on public.player_points for select using (auth.uid() is not null);

-- ── GLOBAL AWARDS ─────────────────────────────────────────────
-- Club-wide point events (everyone gets X pts)
create table if not exists public.global_awards (
  id            uuid primary key default uuid_generate_v4(),
  title         text not null,
  description   text,
  points        integer not null,
  target_category text default 'All',
  awarded_by    uuid references public.profiles(id),
  awarded_at    timestamptz default now()
);
alter table public.global_awards enable row level security;
create policy "Coaches manage global awards" on public.global_awards for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All can read global awards" on public.global_awards for select using (auth.uid() is not null);

-- ── FAN CARD ──────────────────────────────────────────────────
create table if not exists public.fan_card (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid unique references public.players(id) on delete cascade,
  fav_club        text,
  fav_club_short  text,
  fav_intl_team   text,
  fav_intl_code   text,
  idol_name       text,
  idol_number     integer,
  nickname        text,
  updated_at      timestamptz default now()
);
alter table public.fan_card enable row level security;
create policy "Coaches manage fan cards" on public.fan_card for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Parents manage own fan card" on public.fan_card for all using (
  exists (select 1 from public.guardians g where g.player_id = fan_card.player_id and g.profile_id = auth.uid())
);
create policy "All can read fan cards" on public.fan_card for select using (auth.uid() is not null);

-- ── STORAGE ───────────────────────────────────────────────────
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

-- ── AFTER SETUP: make yourself admin ──────────────────────────
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'aumeeramyaaz@gmail.com';
