-- OPFC Connect — Supabase Schema
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New query

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES (extends Supabase auth.users) ─────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text unique not null,
  full_name   text not null,
  role        text not null check (role in ('admin','coach','parent','player')),
  avatar_url  text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Coaches/admins can read all profiles" on public.profiles for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

-- ── PLAYERS ───────────────────────────────────────────────────────────
create table public.players (
  id              uuid primary key default uuid_generate_v4(),
  profile_id      uuid references public.profiles(id),
  player_code     text unique,                         -- OPFC-001
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
create policy "Coaches/admins can manage players" on public.players for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents can read own player" on public.players for select using (
  profile_id = auth.uid() or
  exists (select 1 from public.guardians g where g.player_id = players.id and g.profile_id = auth.uid())
);

-- Auto-generate player code
create or replace function generate_player_code() returns trigger as $$
declare
  next_num integer;
begin
  select coalesce(max(cast(substring(player_code from 6) as integer)), 0) + 1
  into next_num
  from public.players where player_code is not null;
  new.player_code := 'OPFC-' || lpad(next_num::text, 3, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_player_code before insert on public.players
  for each row when (new.player_code is null)
  execute function generate_player_code();

-- ── GUARDIANS ─────────────────────────────────────────────────────────
create table public.guardians (
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
create policy "Coaches/admins can manage guardians" on public.guardians for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Guardians can read own record" on public.guardians for select using (profile_id = auth.uid());

-- ── PLAYER STATS ──────────────────────────────────────────────────────
create table public.player_stats (
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
  assessed_month  text not null,           -- "2026-05"
  assessed_by     uuid references public.profiles(id),
  created_at      timestamptz default now()
);

alter table public.player_stats enable row level security;
create policy "Coaches/admins can manage stats" on public.player_stats for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents can read own stats" on public.player_stats for select using (
  exists (select 1 from public.players pl
    where pl.id = player_stats.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- ── TRAINING SESSIONS ─────────────────────────────────────────────────
create table public.training_sessions (
  id               uuid primary key default uuid_generate_v4(),
  title            text not null,
  session_type     text not null check (session_type in ('training','match','tournament')),
  category         text not null,
  date             date not null,
  time_start       time not null,
  duration_minutes integer default 90,
  venue            text not null default 'Morcellement Raffray Football Ground',
  notes            text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz default now()
);

alter table public.training_sessions enable row level security;
create policy "Coaches/admins can manage sessions" on public.training_sessions for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All authenticated users can read sessions" on public.training_sessions for select using (auth.uid() is not null);

-- ── ATTENDANCE ────────────────────────────────────────────────────────
create table public.attendance (
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
create policy "Coaches/admins can manage attendance" on public.attendance for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents can read own attendance" on public.attendance for select using (
  exists (select 1 from public.players pl
    where pl.id = attendance.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- ── PAYMENTS ──────────────────────────────────────────────────────────
create table public.payments (
  id            uuid primary key default uuid_generate_v4(),
  player_id     uuid references public.players(id) on delete cascade,
  type          text not null check (type in ('entry','monthly')),
  month         text,                      -- "2026-05" for monthly
  amount        integer not null,          -- in Rs
  status        text not null default 'pending' check (status in ('pending','paid','overdue')),
  confirmed_by  uuid references public.profiles(id),
  confirmed_at  timestamptz,
  notes         text,
  created_at    timestamptz default now()
);

alter table public.payments enable row level security;
create policy "Coaches/admins can manage payments" on public.payments for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Players/parents can read own payments" on public.payments for select using (
  exists (select 1 from public.players pl
    where pl.id = payments.player_id
    and (pl.profile_id = auth.uid() or
         exists (select 1 from public.guardians g where g.player_id = pl.id and g.profile_id = auth.uid())))
);

-- ── ANNOUNCEMENTS ─────────────────────────────────────────────────────
create table public.announcements (
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
create policy "Coaches/admins can manage announcements" on public.announcements for all using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "All authenticated users can read announcements" on public.announcements for select using (auth.uid() is not null);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────────────
create or replace function update_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger players_updated_at before update on public.players
  for each row execute function update_updated_at();
create trigger profiles_updated_at before update on public.profiles
  for each row execute function update_updated_at();

-- ── USEFUL VIEWS ──────────────────────────────────────────────────────
create view public.player_overview as
select
  p.id, p.player_code, p.full_name, p.category, p.position,
  p.date_of_birth, p.photo_url, p.qr_code, p.is_active,
  ps.pac, ps.sho, ps.pas, ps.dri, ps.def, ps.phy, ps.ovr,
  ps.coach_notes, ps.assessed_month,
  g.full_name as guardian_name, g.phone_primary, g.email as guardian_email,
  g.relationship,
  coalesce(pay.status, 'pending') as payment_status,
  round(100.0 * sum(case when a.status = 'present' then 1 else 0 end)::numeric /
    nullif(count(a.id), 0), 0) as attendance_rate
from public.players p
left join public.player_stats ps on ps.player_id = p.id
  and ps.assessed_month = to_char(now(), 'YYYY-MM')
left join public.guardians g on g.player_id = p.id
left join public.payments pay on pay.player_id = p.id and pay.type = 'monthly'
  and pay.month = to_char(now(), 'YYYY-MM')
left join public.attendance a on a.player_id = p.id
group by p.id, ps.pac, ps.sho, ps.pas, ps.dri, ps.def, ps.phy, ps.ovr,
  ps.coach_notes, ps.assessed_month, g.full_name, g.phone_primary,
  g.email, g.relationship, pay.status;

-- ── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
create or replace function public.handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'parent'   -- default role; coach/admin changes manually
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── STORAGE BUCKET FOR PLAYER PHOTOS ─────────────────────────
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Anyone can view avatars" on storage.objects for select using (bucket_id = 'avatars');
create policy "Coaches can upload avatars" on storage.objects for insert with check (
  bucket_id = 'avatars' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);
create policy "Coaches can update avatars" on storage.objects for update using (
  bucket_id = 'avatars' and
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin','coach'))
);

-- ── SEED: Initial admin account (change email/name after setup) ───────
-- After running this schema, create your account through the app,
-- then run: update public.profiles set role = 'admin' where email = 'your@email.com';
